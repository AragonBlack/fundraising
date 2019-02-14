pragma solidity ^0.4.24;


contract ITap {
    function withdraw(address _token) external;
    function updateTap(address _token, uint256 _tap) external;
    function updateVault(address _vault) external;
    function updateCollateralPool(address _pool) external;
}
