export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" && specifier.endsWith(".js")) {
      const tsSpecifier = specifier.replace(/\.js$/, ".ts");
      return nextResolve(tsSpecifier, context);
    }
    throw err;
  }
}
