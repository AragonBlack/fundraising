contract("Tap", accounts => {
  context("initialize", () => {
    it("should initialize tap rate, collateral pool and vault", async () => {});

    it("should revert on re-initialization", async () => {});
  });

  context("withdraw", () => {
    context("ETH", () => {
      it("should transfer a tap-defined amount of ETH from the collateral pool to the vault", async () => {});
    });

    context("ERC20", () => {
      it("should transfer a tap-defined amount of ERC20 from the collateral pool to the vault", async () => {});
    });

    it("it should revert if sender does not have 'WITHDRAW_ROLE'", async () => {});
  });

  context("updateTap", () => {
    it("should update tap rate", async () => {});
  });

  context("updateVault", () => {
    it("should update vault address", async () => {});
  });

  context("updateCollateralPool", () => {
    it("should update collateral pool address", async () => {});
  });
});
