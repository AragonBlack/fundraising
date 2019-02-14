pragma solidity ^0.4.24;


contract ITap {
    function withdraw() external;
    function updateTap(uint256 _tap) external;
    function updateVault(address _vault) external;
}
