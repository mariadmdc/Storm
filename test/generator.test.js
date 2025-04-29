import generate from "../src/generator.js";

describe("Code Generator", () => {
  test("generates variable declaration", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "VariableDeclaration",
          variable: { kind: "Variable", name: "x" },
          initializer: { kind: "NumberLiteral", value: 5 }
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/let x_1 = 5;/);
  });

  test("generates function declaration", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "FunctionDeclaration",
          fun: {
            kind: "Function",
            name: "sum",
            parameters: [
              { kind: "Variable", name: "a" },
              { kind: "Variable", name: "b" }
            ],
            body: [
              {
                kind: "SayStatement",
                argument: {
                  kind: "BinaryExpression",
                  op: "+",
                  left: { kind: "Variable", name: "a" },
                  right: { kind: "Variable", name: "b" }
                }
              }
            ]
          }
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/function sum_1\(a_2, b_3\)/);
    expect(js).toMatch(/console\.log\(\(a_2 \+ b_3\)\);/);
  });

  test("generates class (object declaration)", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "ObjectDeclaration",
          obj: {
            kind: "Function",
            name: "Point",
            parameters: [
              { kind: "Variable", name: "x" },
              { kind: "Variable", name: "y" }
            ],
            body: [
              {
                kind: "VariableDeclaration",
                variable: { kind: "Variable", name: "z" },
                initializer: { kind: "NumberLiteral", value: 0 }
              }
            ]
          }
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/class Point_1/);
    expect(js).toMatch(/constructor\(x_2, y_3\)/);
    expect(js).toMatch(/this\.x_2 = x_2;/);
    expect(js).toMatch(/this\.y_3 = y_3;/);
    expect(js).toMatch(/this\.z_4 = 0;/);
  });

  test("generates if statement with else", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "IfStatement",
          test: {
            kind: "BinaryExpression",
            op: ">",
            left: { kind: "Variable", name: "x" },
            right: { kind: "NumberLiteral", value: 10 }
          },
          consequent: [
            {
              kind: "SayStatement",
              argument: { kind: "StringLiteral", value: "Big" }
            }
          ],
          alternate: [
            {
              kind: "SayStatement",
              argument: { kind: "StringLiteral", value: "Small" }
            }
          ]
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/if\s*\(x_1 > 10\)/);
    expect(js).toMatch(/console\.log\("Big"\);/);
    expect(js).toMatch(/else/);
    expect(js).toMatch(/console\.log\("Small"\);/);
  });

  test("generates loop with condition", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "LoopStatement",
          modifier: {
            type: "while",
            kind: "BinaryExpression",
            op: "<",
            left: { kind: "Variable", name: "i" },
            right: { kind: "NumberLiteral", value: 5 }
          },
          body: [
            {
              kind: "ExpressionStatement",
              expression: {
                kind: "CallExpression",
                callee: { kind: "Variable", name: "process" },
                args: [{ kind: "Variable", name: "i" }]
              }
            }
          ]
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/while\s*\(i_1 < 5\)/);
    expect(js).toMatch(/process_2\(i_1\);/);
  });

  test("generates infinite loop", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "LoopStatement",
          modifier: { type: "forever" },
          body: [
            {
              kind: "StopStatement"
            }
          ]
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/while\s*\(true\)/);
    expect(js).toMatch(/break;/);
  });

  test("generates ask/prompt literal", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "SayStatement",
          argument: {
            kind: "AskLiteral",
            value: '"Enter name:"'
          }
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/console\.log\(prompt\("Enter name:"\)\);/);
  });

  test("generates unary expression", () => {
    const ast = {
      kind: "Program",
      statements: [
        {
          kind: "SayStatement",
          argument: {
            kind: "UnaryExpression",
            op: "-",
            operand: { kind: "NumberLiteral", value: 7 }
          }
        }
      ]
    };
    const js = generate(ast);
    expect(js).toMatch(/console\.log\(-7\);/);
  });
});
