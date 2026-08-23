// HTTP entry point — owns listening only; app wiring lives in src/app.ts.

import { app } from "./app.ts";

const port = parseInt(process.env.PORT || "3000", 10);
console.log(`Eventify listening on port ${port}`);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});