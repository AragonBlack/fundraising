pragma solidity 0.4.24;


contract ITap {
     function updateBeneficiary(address _beneficiary) external;
     function updateMaximumTapRateIncreasePct(uint256 _maximumTapRateIncreasePct) external;
     function updateMaximumTapFloorDecreasePct(uint256 _maximumTapFloorDecreasePct) external;
     function addTappedToken(address _token, uint256 _rate, uint256 _floor) external;
     function updateTappedToken(address _token, uint256 _rate, uint256 _floor) external;
     function resetTappedToken(address _token) external;
     function updateTappedAmount(address _token) external;
     function withdraw(address _token) external;
     function getMaximumWithdrawal(address _token) public view returns (uint256);
     function rates(address _token) public view returns (uint256);
 }