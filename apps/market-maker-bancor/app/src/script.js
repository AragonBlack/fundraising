import Aragon from "@aragon/client";

const app = new Aragon();

app.store(async (state, event) => {
  if (state === null) {
    //
  }

  switch (event.event) {
    default:
      return state;
  }
});
