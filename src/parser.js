import * as fs    from "node:fs";
import * as ohm   from "ohm-js";
import analyze    from "./analyzer.js";

const grammar = ohm.grammar(
  fs.readFileSync("src/Storm.ohm", "utf8")
);

export default function parse(sourceCode) {
  const match = grammar.match(sourceCode, "Program");
  if (!match.succeeded()) {
    // include line/col info from Ohm’s match.message
    throw new SyntaxError(match.message);
  }
  // now run your semantics → AST / core IR
  return analyze(match);
}
