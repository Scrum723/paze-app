// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PAZERewards
 * @dev Decentralized Road Intelligence Reward Vault and Attestation Registry for PAZE.
 * Supports ERC-20 rewards (e.g. USDC / PAZE tokens), cryptographic hazard attestations,
 * and verified driver batch payouts across Layer 2 networks (Base, Polygon, Arbitrum).
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract PAZERewards {
    address public owner;
    address public trustedSigner;
    IERC20 public rewardToken; // USDC or native PAZE utility token

    uint256 public totalReportsLogged;
    uint256 public totalRewardsDistributed;

    struct RoadHazardAttestation {
        bytes32 hazardHash;      // keccak256(hazardType, lat, lng, timestamp)
        address reporter;
        int64 latitude;          // scaled by 1e6
        int64 longitude;         // scaled by 1e6
        uint64 timestamp;
        uint32 confirmations;
        bool settled;
    }

    mapping(bytes32 => RoadHazardAttestation) public attestations;
    mapping(address => uint256) public driverPendingBalances;
    mapping(address => uint256) public driverLifetimeEarned;
    mapping(bytes32 => bool) public executedPayouts;

    event HazardAttested(bytes32 indexed hazardHash, address indexed reporter, int64 lat, int64 lng, string hazardType);
    event HazardConfirmed(bytes32 indexed hazardHash, address indexed validator, uint32 totalConfirms);
    event RewardPaid(address indexed driver, uint256 amount, bytes32 indexed payoutId, string rail);
    event SignerUpdated(address indexed newSigner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address _rewardToken, address _trustedSigner) {
        owner = msg.sender;
        trustedSigner = _trustedSigner;
        rewardToken = IERC20(_rewardToken);
    }

    function setTrustedSigner(address _newSigner) external onlyOwner {
        trustedSigner = _newSigner;
        emit SignerUpdated(_newSigner);
    }

    /**
     * @dev Attest a road hazard on-chain with cryptographic integrity.
     */
    function attestHazard(
        string calldata hazardType,
        int64 lat,
        int64 lng,
        uint64 timestamp,
        bytes calldata signature
    ) external returns (bytes32) {
        bytes32 messageHash = keccak256(abi.encodePacked(hazardType, lat, lng, timestamp, msg.sender, block.chainid));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        address recovered = recoverSigner(ethSignedMessageHash, signature);
        require(recovered == trustedSigner || recovered == msg.sender, "Invalid attestation signature");

        bytes32 hHash = keccak256(abi.encodePacked(hazardType, lat, lng, timestamp));
        require(attestations[hHash].timestamp == 0, "Hazard already attested");

        attestations[hHash] = RoadHazardAttestation({
            hazardHash: hHash,
            reporter: msg.sender,
            latitude: lat,
            longitude: lng,
            timestamp: timestamp,
            confirmations: 1,
            settled: false
        });

        totalReportsLogged++;
        emit HazardAttested(hHash, msg.sender, lat, lng, hazardType);
        return hHash;
    }

    /**
     * @dev Claim driver earnings using a signed payout voucher from PAZE verification network.
     */
    function claimEarnings(
        uint256 amount,
        bytes32 payoutId,
        uint64 expiry,
        bytes calldata signature,
        string calldata rail
    ) external {
        require(block.timestamp <= expiry, "Payout voucher expired");
        require(!executedPayouts[payoutId], "Payout already claimed");

        bytes32 voucherHash = keccak256(abi.encodePacked(msg.sender, amount, payoutId, expiry, block.chainid));
        bytes32 ethSignedVoucher = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", voucherHash));

        require(recoverSigner(ethSignedVoucher, signature) == trustedSigner, "Invalid voucher signature");

        executedPayouts[payoutId] = true;
        driverLifetimeEarned[msg.sender] += amount;
        totalRewardsDistributed += amount;

        if (address(rewardToken) != address(0)) {
            require(rewardToken.transfer(msg.sender, amount), "Token transfer failed");
        } else {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "Native ETH transfer failed");
        }

        emit RewardPaid(msg.sender, amount, payoutId, rail);
    }

    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _sig) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(_sig);
        return ecrecover(_ethSignedMessageHash, v, r, s);
    }

    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }

    receive() external payable {}
}
