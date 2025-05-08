const path = require("path");
const parse = require("../src/parser.js");

describe("Semantic Analyzer – valid programs", () => {
  test("simple variable declaration", () => {
    expect(() => parse(`set x to 5`)).not.toThrow();
  });

  test("variable usage in expression", () => {
    const src = `
      set x to 5
      set y to x + 2
    `;
    expect(() => parse(src)).not.toThrow();
  });

  test("function declaration without call", () => {
    const src = `
      set program foo(a, b)
        set c to a + b
      end program
    `;
    expect(() => parse(src)).not.toThrow();
  });

  test("function call with correct arguments", () => {
    const src = `
      set program foo(a, b)
      end program
      foo(1, 2)
    `;
    expect(() => parse(src)).not.toThrow();
  });

  test("loop with stop running", () => {
    const src = `
      start lap forever
        stop running
      lap
    `;
    expect(() => parse(src)).not.toThrow();
  });

  test("if with boolean expression", () => {
    const src = `
      set x to 1
      if x = 1
        say x
      end if
    `;
    expect(() => parse(src)).not.toThrow();
  });
});

describe("Semantic Analyzer – error cases", () => {
  test("redeclaration of a variable", () => {
    const src = `
      set x to 1
      set x to 2
    `;
    expect(() => parse(src)).toThrow(/Already declared: x/);
  });

  test("use of undeclared variable", () => {
    expect(() => parse(`set y to x`)).toThrow(/x not declared/);
  });

  test("stop running outside of loop", () => {
    expect(() => parse(`stop running`)).toThrow(/stop running only inside a lap/);
  });

  test("calling a non-function", () => {
    const src = `
      set x to 1
      x()
    `;
    expect(() => parse(src)).toThrow(/x is not a function/);
  });

  test("wrong number of arguments in function call", () => {
    const src = `
      set program foo(a)
      end program
      foo()
    `;
    expect(() => parse(src)).toThrow(/Expected 1 arg/);
  });

  test("if with non-boolean condition", () => {
    const src = `
      set x to 5
      if x
        say x
      end if
    `;
    expect(() => parse(src)).toThrow(/Expected boolean/);
  });

  test("type error in numeric operation", () => {
    const src = `
      set x to 1
      set flag to x = 1
      set y to flag + 2
    `;
    expect(() => parse(src)).toThrow(/Expected number/);
  });

  test("undeclared variable in expression", () => {
    expect(() => parse(`set x to y + 1`)).toThrow(/y not declared/);
  });
});
