// Implements constant folding, identity simplifications, and dead-code elimination after StopStatement!
export default function optimize(node) {
  function visit(n) {
    if (n == null || typeof n !== "object") {
      return n;
    }
    switch (n.kind) {
      case "Program": {
        const newStmts = [];
        for (const stmt of n.statements) {
          const optStmt = visit(stmt);
          if (Array.isArray(optStmt)) {
            newStmts.push(...optStmt);
          } else {
            newStmts.push(optStmt);
            if (optStmt.kind === "StopStatement") {
              break;
            }
          }
        }
        return { ...n, statements: newStmts };
      }
      case "FunctionDeclaration": {
        const fn = n.fun;
        const newBody = [];
        for (const stmt of fn.body) {
          const optStmt = visit(stmt);
          newBody.push(optStmt);
          if (optStmt.kind === "StopStatement") {
            break;
          }
        }
        const newFun = { ...fn, body: newBody };
        return { ...n, fun: newFun };
      }
      case "ObjectDeclaration": {
        const cls = n.obj;
        const newBody = [];
        for (const stmt of cls.body) {
          const optStmt = visit(stmt);
          newBody.push(optStmt);
          if (optStmt.kind === "StopStatement") {
            break;
          }
        }
        const newObj = { ...cls, body: newBody };
        return { ...n, obj: newObj };
      }
      case "LoopStatement": {
        // optimizing loop condition if it's an IR node .......
        const mod = n.modifier && n.modifier.kind ? visit(n.modifier) : n.modifier;
        const newBody = [];
        for (const stmt of n.body) {
          const optStmt = visit(stmt);
          newBody.push(optStmt);
          if (optStmt.kind === "StopStatement") {
            break;
          }
        }
        return { ...n, modifier: mod, body: newBody };
      }
      case "IfStatement": {
        const test = visit(n.test);
        const cons = n.consequent.map(visit);
        const alt = n.alternate ? n.alternate.map(visit) : null;
        return { ...n, test, consequent: cons, alternate: alt };
      }
      case "VariableDeclaration":
        return { ...n, initializer: visit(n.initializer) };
      case "ExpressionStatement":
        return { ...n, expression: visit(n.expression) };
      case "SayStatement":
        return { ...n, argument: visit(n.argument) };
      case "BinaryExpression": {
        const left = visit(n.left);
        const right = visit(n.right);
        const op = n.op;
        // optimizing constant folding for numbers..........
        if (left.kind === "NumberLiteral" && right.kind === "NumberLiteral") {
          let result;
          switch (op) {
            case "+": result = left.value + right.value; break;
            case "-": result = left.value - right.value; break;
            case "*": result = left.value * right.value; break;
            case "/": result = left.value / right.value; break;
            case "^": result = Math.pow(left.value, right.value); break;
          }
          return { kind: "NumberLiteral", value: result };
        }
        // optimizing constant folding for string concatenation.......
        if (op === "+" && left.kind === "StringLiteral" && right.kind === "StringLiteral") {
          return { kind: "StringLiteral", value: left.value + right.value };
        }
        // optimizing identity rules......
        if (op === "+" && left.kind === "NumberLiteral" && left.value === 0) {
          return right;
        }
        if (op === "+" && right.kind === "NumberLiteral" && right.value === 0) {
          return left;
        }
        if (op === "-" && right.kind === "NumberLiteral" && right.value === 0) {
          return left;
        }
        if (op === "*" && left.kind === "NumberLiteral" && left.value === 1) {
          return right;
        }
        if (op === "*" && right.kind === "NumberLiteral" && right.value === 1) {
          return left;
        }
        if (op === "/" && right.kind === "NumberLiteral" && right.value === 1) {
          return left;
        }
        return { ...n, left, right };
      }
      case "UnaryExpression": {
        const operand = visit(n.operand);
        if (n.op === "-" && operand.kind === "NumberLiteral") {
          return { kind: "NumberLiteral", value: -operand.value };
        }
        if (n.op === "not" && operand.kind === "BooleanLiteral") {
          return { kind: "BooleanLiteral", value: !operand.value };
        }
        return { ...n, operand };
      }
      default:
        return n;
    }
  }
  return visit(node);
}
