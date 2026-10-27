// Asset spec for the sprite generator: not a test, though it sits in a spec/ folder.
export const mobs = [{ name: "zombie", frames: 8 }];
console.log("loaded", mobs.length);
await new Promise((r) => setTimeout(r, 10));
