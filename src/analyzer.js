import * as core from "./core.js";

export default function analyze(match) {
  const grammar = match.matcher.grammar;

  class Context {
    constructor(parent = null, inLoop = false) {
      this.locals = new Map();
      this.inLoop = inLoop;
      this.parent = parent;
    }
    add(name, entity) {
      this.locals.set(name, entity);
    }
    has(name) {
      return this.locals.has(name) || (this.parent && this.parent.has(name));
    }
    lookup(name) {
      return this.locals.get(name) || (this.parent && this.parent.lookup(name));
    }
    newChildContext(inLoop = this.inLoop) {
      return new Context(this, inLoop);
    }
  }

  let context = new Context();

  function check(cond, msg, node) {
    if (!cond) {
      throw new Error(`${node.source.getLineAndColumnMessage()} ${msg}`);
    }
  }
  function checkNumber(e, node) { check(e.type === "number" || e.type === "any", "Expected number", node); }
  function checkBoolean(e, node) { check(e.type === "boolean" || e.type === "any", "Expected boolean", node); }
  function checkNotDeclared(name, node) { check(!context.has(name), `Already declared: ${name}`, node); }
  function checkFunction(e, node) { check(e && e.kind === "Function", `${e ? e.name : 'Unknown'} is not a function`, node); }
  function checkArgumentCount(params, args, node) { check(params.length === args.length, `Expected ${params.length} arg(s) but got ${args.length}`, node); }

  const analyzer = grammar.createSemantics().addOperation("analyze", {
    Program(stmts) {
      const list = stmts.children.map(s => s.analyze()).filter(x => x !== null);
      return core.program(list);
    },

    VarDecl(_set, _ws1, lhs, _ws2, _to, _ws3, expr) {
      const name = lhs.sourceString;
      checkNotDeclared(name, lhs);
      const value = expr.analyze();
      const variable = core.variable(name, value.type, true);
      context.add(name, variable);
      return core.variableDeclaration(variable, value);
    },

    FunctionDecl(_set, _ws1, _prog, _ws2, id, _o, params, _c, _wsA, block, _wsB, _end, _wsC, _prog2) {
      checkNotDeclared(id.sourceString, id);
      const parentCtx = context;
      context = context.newChildContext(false);
      let parameters = [];
      if (params.children.length > 0) {
        parameters = params.analyze();
      }
      const body = block.analyze();
      const func = core.functionDeclaration(id.sourceString, parameters, "void", body);
      parentCtx.add(id.sourceString, func);
      context = parentCtx;
      return func;
    },

    ObjectDecl(_set, _ws1, _obj, _ws2, id, _o, params, _c, _wsA, block, _wsB, _end, _wsC, _obj2) {
      checkNotDeclared(id.sourceString, id);
      const parentCtx = context;
      context = context.newChildContext(false);
      let parameters = [];
      if (params.children.length > 0) {
        parameters = params.analyze();
      }
      const body = block.analyze();
      const obj = core.objectDeclaration(id.sourceString, parameters, body);
      parentCtx.add(id.sourceString, obj);
      context = parentCtx;
      return obj;
    },

    LoopStmt(_start, _ws1, _lap, _ws2, modifier, _ws3, block, _ws4, _lap2) {
      let cond;
      if (modifier.ctorName === "forever") {
        cond = { type: "forever" };
      } else {
        cond = modifier.analyze();
        checkBoolean(cond, modifier);
      }
      const parentCtx = context;
      context = context.newChildContext(true);
      const body = block.analyze();
      context = parentCtx;
      return core.loopStatement(cond, body);
    },

    // Updated IfStmt to match `if ... else ... end if`
    IfStmt(_if, _ws1, cond, _ws2, thenBlock, elsePart, _end, _ws3, _if2) {
      const condition = cond.analyze();
      checkBoolean(condition, cond);
      const thenBody = thenBlock.analyze();
      let elseBody = null;
      if (elsePart.children.length > 0) {
        // elsePart = [_, 'else', _, Block]
        elseBody = elsePart.children[3].analyze();
      }
      return core.ifStatement(condition, thenBody, elseBody);
    },

    SayStmt(_say, _ws, expr) {
      const arg = expr.analyze();
      return core.sayStatement(arg);
    },
    StopStmt(_stop, _ws, _running) {
      check(context.inLoop, "stop running only inside a lap", _stop);
      return core.stopStatement();
    },

    ExpressionStmt(expr) {
      return core.expressionStatement(expr.analyze());
    },

    Block(stmts) {
      const parentCtx = context;
      context = context.newChildContext(parentCtx.inLoop);
      const list = stmts.children.map(s => s.analyze()).filter(x => x !== null);
      context = parentCtx;
      return list;
    },

    // Fixed LHS to check rest length, not children length
    LHS(id, rest) {
      if (rest.children.length === 0) {
        const variable = context.lookup(id.sourceString);
        check(variable, `${id.sourceString} not declared`, id);
        return variable;
      } else {
        let base = context.lookup(id.sourceString);
        check(base, `${id.sourceString} not declared`, id);
        // property chain => any
        return { type: "any" };
      }
    },

    // Expression hierarchy
    Expression(node) { return node.analyze(); },

    OrExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const right = chunk.children[3].analyze();
        checkBoolean(left, chunk.children[1]);
        checkBoolean(right, chunk.children[1]);
        left = core.binaryExpression("or", left, right, "boolean");
      }
      return left;
    },
    AndExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const right = chunk.children[3].analyze();
        checkBoolean(left, chunk.children[1]);
        checkBoolean(right, chunk.children[1]);
        left = core.binaryExpression("and", left, right, "boolean");
      }
      return left;
    },
    EqExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const op = chunk.children[1].sourceString;
        const right = chunk.children[3].analyze();
        left = core.binaryExpression(op, left, right, "boolean");
      }
      return left;
    },
    RelExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const op = chunk.children[1].sourceString;
        const right = chunk.children[3].analyze();
        left = core.binaryExpression(op, left, right, "boolean");
      }
      return left;
    },
    AddExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const op = chunk.children[1].sourceString;
        const right = chunk.children[3].analyze();
        if (op === "+") {
          if (left.type === "string" || right.type === "string") {
            left = core.binaryExpression("+", left, right, "string");
          } else {
            checkNumber(left, chunk.children[1]);
            checkNumber(right, chunk.children[3]);
            left = core.binaryExpression("+", left, right, "number");
          }
        } else {
          checkNumber(left, chunk.children[1]);
          checkNumber(right, chunk.children[3]);
          left = core.binaryExpression("-", left, right, "number");
        }
      }
      return left;
    },
    MulExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const op = chunk.children[1].sourceString;
        const right = chunk.children[3].analyze();
        checkNumber(left, chunk.children[1]);
        checkNumber(right, chunk.children[3]);
        left = core.binaryExpression(op, left, right, "number");
      }
      return left;
    },
    PowExp(first, rest) {
      let left = first.analyze();
      if (rest.children.length > 0) {
        const right = rest.children[3].analyze();
        checkNumber(left, rest.children[1]);
        checkNumber(right, rest.children[3]);
        left = core.binaryExpression("^", left, right, "number");
      }
      return left;
    },
    UnaryExp(op, _ws, expr) {
      const val = expr.analyze();
      if (op.sourceString === "-") {
        checkNumber(val, op);
        return core.unaryExpression("-", val, "number");
      } else if (op.sourceString === "not") {
        checkBoolean(val, op);
        return core.unaryExpression("not", val, "boolean");
      }
      return val;
    },
    Postfix(atom, tails) {
      let val = atom.analyze();
      for (let t of tails.children) {
        if (t.ctorName === "CallTail") {
          const args = t.analyze();
          checkFunction(val, t);
          checkArgumentCount(val.parameters, args, t);
          val = core.callExpression(val, args, val.returnType || "void");
        } else {
          // PropTail
          val = { type: "any" };
        }
      }
      return val;
    },
    CallTail(_o, args, _c) {
      return args.children.length === 0 ? [] : args.analyze();
    },
    PropTail(_dot, id) { return id.sourceString; },

    CallArgList(list) { return list.asIteration().children.map(a => a.analyze()); },
    NamedCallArg(id, _w1, _to, _w2, expr) {
      return { name: id.sourceString, value: expr.analyze() };
    },
    PositionalCallArg(expr) { return expr.analyze(); },

    ParameterList(list) {
      return list.asIteration().children.map(id => {
        checkNotDeclared(id.sourceString, id);
        const p = core.variable(id.sourceString, "any", false);
        context.add(id.sourceString, p);
        return p;
      });
    },

    NumberLiteral(tok) { return { type: "number", value: Number(tok.sourceString) }; },
    StringLiteral(_open, chars, _close) { return { type: "string", value: chars.sourceString }; },
    AskLiteral(_ask, _ws, str) { return { type: "string", value: str.sourceString }; },
    identifier(_f, _r) {
      const v = context.lookup(this.sourceString);
      check(v, `${this.sourceString} not declared`, this);
      return v;
    },
    ParenExp(_o, _w1, expr, _w2, _c) { return expr.analyze(); }
  });

  return analyzer(match).analyze();
}
