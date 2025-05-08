// grammar.test.js
import fs from "fs";
import path from "path";
import ohm from "ohm-js";

const grammarSource = fs.readFileSync(
  path.join(__dirname, "src/Storm.ohm"),
  "utf8"
);
const grammar = ohm.grammar(grammarSource);

// Helpers
function shouldParse(src) {
  const match = grammar.match(src, "Program");
  expect(match.succeeded()).toBe(true);
}
function shouldFail(src) {
  const match = grammar.match(src, "Program");
  expect(match.succeeded()).toBe(false);
}

describe("Storm grammar – valid programs", () => {
  test("variable declaration", () => {
    shouldParse(`set x to 42`);
    shouldParse(`set myVar to x + 3 * (y - 1)`);
  });

  test("function declaration", () => {
    shouldParse(`
      set program foo() 
        say "hi"
      end program
    `);
    shouldParse(`
      set program add(a, b)
        set sum to a + b
        say sum
      end program
    `);
  });

  test("object declaration", () => {
    shouldParse(`
      set object Box(width, height) 
        set area to width * height
      end object
    `);
  });

  test("loops", () => {
    shouldParse(`
      start lap forever
        stop running
      lap
    `);
    shouldParse(`
      start lap i < 10
        set i to i + 1
      lap
    `);
  });

  test("if/else", () => {
    shouldParse(`
      if x = 1
        say "one"
      end if
    `);
    shouldParse(`
      if x > 0
        say "pos"
      else
        say "non-pos"
      end if
    `);
  });

  test("say & stop statements", () => {
    shouldParse(`say "hello world"`);
    shouldParse(`say 123 * 2`);
    shouldParse(`stop running`); // inside a loop only, but grammar accepts it
  });

  test("expression statements", () => {
    shouldParse(`x + y`);
    shouldParse(`ask "name"`);
    shouldParse(`foo.bar(1,2).baz`);
  });

  test("number literals", () => {
    shouldParse(`0`);
    shouldParse(`123`);
    shouldParse(`3.14159`);
  });

  test("string literals", () => {
    shouldParse(`"simple"`);
    shouldParse(`"with spaces and 123"`);
  });

  test("unary & binary operators", () => {
    shouldParse(`-x`);
    shouldParse(`not true and false or x != y`);
    shouldParse(`2 ^ 3 ^ 2`);  // right associative
  });

  test("blocks & nesting", () => {
    shouldParse(`
      set program nest()
        start lap forever
          if a <= b
            say "ok"
          else
            stop running
          end if
        lap
      end program
    `);
  });
});

describe("Storm grammar – invalid programs", () => {
  test("bad var decl", () => {
    shouldFail(`set 5 to x`);
    shouldFail(`set x too 5`);
  });

  test("bad func/object decl", () => {
    // cannot use reserved word as identifier
    shouldFail(`
      set program program()
      end program
    `);
    shouldFail(`
      set object if()
      end object
    `);
  });

  test("bad loops", () => {
    shouldFail(`start lap lap`);       // missing modifier
    shouldFail(`start lap x < 10`);    // missing closing `lap`
  });

  test("bad if/else", () => {
    shouldFail(`if x end if`);         // missing condition ops
    shouldFail(`if x = 1 else end if`);// else without then-block
  });

  test("bad statements", () => {
    shouldFail(`say`);                 // missing expression
    shouldFail(`stop`);                // missing `running`
  });

  test("bad literals & identifiers", () => {
    shouldFail(`"unclosed string`);
    shouldFail(`1.`);                  // dot without digits
    shouldFail(`ask name`);            // ask must be followed by string
    shouldFail(`foo . bar`);           // improper spacing around prop
  });
});
