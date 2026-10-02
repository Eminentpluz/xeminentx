// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title PrizeVault
/// @notice Proof-of-payout for hackathon prizes. An organizer locks the full USDC prize
///         pool up front, split into fixed slots. Builders can check on-chain that the
///         money exists before they spend a weekend building. Winners are paid straight
///         from escrow; anything not awarded by the deadline goes back to the organizer.
/// @dev    On Arc, USDC's ERC-20 interface (6 decimals) lives at
///         0x3600000000000000000000000000000000000000. All amounts here use that interface.
contract PrizeVault {
    struct Pool {
        address organizer;
        uint64 awardDeadline;
        bool refunded;
        uint256 total;
        uint256 paid;
        string name;
        string url;
    }

    uint256 public constant MAX_SLOTS = 100;
    uint256 public constant MAX_DURATION = 365 days;

    IERC20 public immutable usdc;

    Pool[] private _pools;
    mapping(uint256 => uint256[]) private _slotAmounts;
    mapping(uint256 => address[]) private _slotWinners;

    event PoolCreated(uint256 indexed poolId, address indexed organizer, uint256 total, uint256 slots, uint64 awardDeadline, string name, string url);
    event SlotAwarded(uint256 indexed poolId, uint256 indexed slot, address indexed winner, uint256 amount);
    event PoolRefunded(uint256 indexed poolId, address indexed organizer, uint256 amount);

    error NoSlots();
    error TooManySlots();
    error ZeroAmount();
    error BadDeadline();
    error NotOrganizer();
    error BadSlot();
    error SlotTaken();
    error BadWinner();
    error DeadlinePassed();
    error DeadlineNotReached();
    error AlreadyRefunded();
    error TransferFailed();

    constructor(IERC20 usdc_) {
        usdc = usdc_;
    }

    /// @notice Lock a prize pool. The caller must have approved `sum(slotAmounts)` USDC first.
    function createPool(string calldata name, string calldata url, uint256[] calldata slotAmounts, uint64 awardDeadline)
        external
        returns (uint256 poolId)
    {
        uint256 n = slotAmounts.length;
        if (n == 0) revert NoSlots();
        if (n > MAX_SLOTS) revert TooManySlots();
        if (awardDeadline <= block.timestamp || awardDeadline > block.timestamp + MAX_DURATION) revert BadDeadline();

        uint256 total;
        for (uint256 i; i < n; ++i) {
            if (slotAmounts[i] == 0) revert ZeroAmount();
            total += slotAmounts[i];
        }

        poolId = _pools.length;
        _pools.push(Pool(msg.sender, awardDeadline, false, total, 0, name, url));
        _slotAmounts[poolId] = slotAmounts;
        _slotWinners[poolId] = new address[](n);

        emit PoolCreated(poolId, msg.sender, total, n, awardDeadline, name, url);
        if (!usdc.transferFrom(msg.sender, address(this), total)) revert TransferFailed();
    }

    /// @notice Pay one slot to a winner. Each slot can be awarded once, before the deadline.
    function award(uint256 poolId, uint256 slot, address winner) external {
        Pool storage p = _pools[poolId];
        if (msg.sender != p.organizer) revert NotOrganizer();
        if (block.timestamp > p.awardDeadline) revert DeadlinePassed();
        if (slot >= _slotAmounts[poolId].length) revert BadSlot();
        if (_slotWinners[poolId][slot] != address(0)) revert SlotTaken();
        if (winner == address(0) || winner == p.organizer) revert BadWinner();

        uint256 amount = _slotAmounts[poolId][slot];
        _slotWinners[poolId][slot] = winner;
        p.paid += amount;

        emit SlotAwarded(poolId, slot, winner, amount);
        if (!usdc.transfer(winner, amount)) revert TransferFailed();
    }

    /// @notice After the deadline, return whatever was not awarded to the organizer.
    function refundUnawarded(uint256 poolId) external {
        Pool storage p = _pools[poolId];
        if (msg.sender != p.organizer) revert NotOrganizer();
        if (block.timestamp <= p.awardDeadline) revert DeadlineNotReached();
        if (p.refunded) revert AlreadyRefunded();

        p.refunded = true;
        uint256 amount = p.total - p.paid;

        emit PoolRefunded(poolId, p.organizer, amount);
        if (amount > 0 && !usdc.transfer(p.organizer, amount)) revert TransferFailed();
    }

    function poolCount() external view returns (uint256) {
        return _pools.length;
    }

    function getPool(uint256 poolId)
        external
        view
        returns (Pool memory pool, uint256[] memory slotAmounts, address[] memory slotWinners)
    {
        return (_pools[poolId], _slotAmounts[poolId], _slotWinners[poolId]);
    }
}
