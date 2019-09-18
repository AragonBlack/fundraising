pragma solidity 0.4.24;


contract IAragonFundraisingController {
    bytes32 public constant UPDATE_BENEFICIARY_ROLE                    = 0xf7ea2b80c7b6a2cab2c11d2290cb005c3748397358a25e17113658c83b732593;
    bytes32 public constant UPDATE_FEES_ROLE                           = 0x5f9be2932ed3a723f295a763be1804c7ebfd1a41c1348fb8bdf5be1c5cdca822;
    bytes32 public constant ADD_COLLATERAL_TOKEN_ROLE                  = 0x217b79cb2bc7760defc88529853ef81ab33ae5bb315408ce9f5af09c8776662d;
    bytes32 public constant REMOVE_COLLATERAL_TOKEN_ROLE               = 0x2044e56de223845e4be7d0a6f4e9a29b635547f16413a6d1327c58d9db438ee2;
    bytes32 public constant UPDATE_COLLATERAL_TOKEN_ROLE               = 0xe0565c2c43e0d841e206bb36a37f12f22584b4652ccee6f9e0c071b697a2e13d;
    bytes32 public constant UPDATE_MAXIMUM_TAP_RATE_INCREASE_PCT_ROLE  = 0x5d94de7e429250eee4ff97e30ab9f383bea3cd564d6780e0a9e965b1add1d207;
    bytes32 public constant UPDATE_MAXIMUM_TAP_FLOOR_DECREASE_PCT_ROLE = 0x57c9c67896cf0a4ffe92cbea66c2f7c34380af06bf14215dabb078cf8a6d99e1;
    bytes32 public constant UPDATE_TOKEN_TAP_ROLE                      = 0xdb8c88bedbc61ea0f92e1ce46da0b7a915affbd46d1c76c4bbac9a209e4a8416;
    bytes32 public constant RESET_TOKEN_TAP_ROLE                       = 0x5bbae5d285f7bf83bf602671568610a2fde1f9729490fa79381f19606b28ad93;
    bytes32 public constant OPEN_PRESALE_ROLE                          = 0xf323aa41eef4850a8ae7ebd047d4c89f01ce49c781f3308be67303db9cdd48c2;
    bytes32 public constant OPEN_TRADING_ROLE                          = 0x26ce034204208c0bbca4c8a793d17b99e546009b1dd31d3c1ef761f66372caf6;
    bytes32 public constant CONTRIBUTE_ROLE                            = 0x9ccaca4edf2127f20c425fdd86af1ba178b9e5bee280cd70d88ac5f6874c4f07;
    bytes32 public constant OPEN_BUY_ORDER_ROLE                        = 0xa589c8f284b76fc8d510d9d553485c47dbef1b0745ae00e0f3fd4e28fcd77ea7;
    bytes32 public constant OPEN_SELL_ORDER_ROLE                       = 0xd68ba2b769fa37a2a7bd4bed9241b448bc99eca41f519ef037406386a8f291c0;
    bytes32 public constant WITHDRAW_ROLE                              = 0x5d8e12c39142ff96d79d04d15d1ba1269e4fe57bb9d26f43523628b34ba108ec;

    function openTrading() external;
    function resetTokenTap(address _token) external;
    function collateralsToBeClaimed(address _collateral) public view returns (uint256);
    function balanceOf(address _who, address _token) public view returns (uint256);
}
