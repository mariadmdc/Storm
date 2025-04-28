import { voidType } from "./core.js";

// Takes a program and emits JavaScript source.
export default function generate(program) {
  const output = [];

  // Map each declared entity to a unique name
  const nameMap = new Map();
  const targetName = entity => {
    if (!nameMap.has(entity)) nameMap.set(entity, nameMap.size + 1);
    return `${entity.name}_${nameMap.get(entity)}`;
  };

  const gen = node => generators[node.kind](node);

  const generators = {
    Program(p) {
      p.statements.forEach(stmt => gen(stmt));
    },

    VariableDeclaration(d) {
      output.push(`let ${gen(d.variable)} = ${gen(d.initializer)};`);
    },

    FunctionDeclaration(d) {
      const fn = d.fun;
      const name = gen(fn);
      const params = fn.parameters.map(gen).join(", ");
      output.push(`function ${name}(${params}) {`);
      fn.body.forEach(stmt => gen(stmt));
      output.push("}");
    },

    ObjectDeclaration(d) {
      const cls = d.obj;
      const name = gen(cls);
      const params = cls.parameters.map(gen).join(", ");
      output.push(`class ${name} {`);
      output.push(`  constructor(${params}) {`);
      // Initialize constructor parameters
      for (let param of cls.parameters) {
        const id = gen(param);
        output.push(`    this.${id} = ${id};`);
      }
      // Any variable declarations in body become fields
      cls.body.forEach(stmt => {
        if (stmt.kind === "VariableDeclaration") {
          const v = stmt.variable;
          output.push(
            `    this.${gen(v)} = ${gen(stmt.initializer)};`
          );
        }
      });
      output.push("  }");
      output.push("}");
    },

    LoopStatement(s) {
      if (s.modifier.type === "forever") {
        output.push("while (true) {");
      } else {
        output.push(`while (${gen(s.modifier)}) {`);
      }
      s.body.forEach(stmt => gen(stmt));
      output.push("}");
    },

    IfStatement(s) {
      output.push(`if (${gen(s.test)}) {`);
      s.consequent.forEach(stmt => gen(stmt));
      if (s.alternate) {
        output.push("} else {");
        s.alternate.forEach(stmt => gen(stmt));
      }
      output.push("}");
    },

    SayStatement(s) {
      output.push(`console.log(${gen(s.argument)});`);
    },

    StopStatement() {
      output.push("break;");
    },

    ExpressionStatement(s) {
      output.push(`${gen(s.expression)};`);
    },

    // --- Expressions return strings ---
    Variable(v) {
      return targetName(v);
    },

    Function(f) {
      return targetName(f);
    },

    NumberLiteral(n) {
      return String(n.value);
    },

    StringLiteral(s) {
      return JSON.stringify(s.value);
    },

    AskLiteral(a) {
      return `prompt(${a.value})`;
    },

    CallExpression(c) {
      const callee = gen(c.callee);
      const args = c.args.map(gen).join(", ");
      return `${callee}(${args})`;
    },

    BinaryExpression(e) {
      const op = e.op === "=" ? "===" : e.op === "!=" ? "!==" : e.op;
      return `(${gen(e.left)} ${op} ${gen(e.right)})`;
    },

    UnaryExpression(e) {
      if (e.op === "-") return `(-${gen(e.operand)})`;
      if (e.op === "not") return `(!${gen(e.operand)})`;
      return `${e.op} ${gen(e.operand)}`;
    }
  };

  gen(program);
  return output.join("\n");
}
