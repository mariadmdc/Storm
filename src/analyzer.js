import * as core from "./core.js";

export default function analyze(match) {
  const grammar = match.matcher.grammar;

  // A context has variable and function declarations and tracks whether we are inside a lap (loop).
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
      return this.locals.has(name);
    }
    lookup(name) {
      // Return from the current map, or recursively from parent contexts
      return this.locals.get(name) || (this.parent && this.parent.lookup(name));
    }
    newChildContext(inLoop = false) {
      return new Context(this, inLoop);
    }
  }

  // Create a global context
  let context = new Context();

  // Helper function for error checking
  function check(condition, message, node) {
    if (!condition) {
      throw new Error(
        `${node.source.getLineAndColumnMessage()} ${message}`
      );
    }
  }

  // Type checkers n stuff
  function checkNumber(e, node) {
    check(e.type === "number" || e.type === "any", "Expected number", node);
  }
  function checkBoolean(e, node) {
    check(e.type === "boolean" || e.type === "any", "Expected boolean", node);
  }
  function checkNotDeclared(name, node) {
    check(!context.has(name), `Variable already declared: ${name}`, node);
  }
  function checkFunction(entity, node) {
    check(entity && entity.kind === "Function", `${entity ? entity.name : "Unknown"} is not a function`, node);
  }
  function checkArgumentCount(parameters, args, node) {
    check(
      parameters.length === args.length,
      `Expected ${parameters.length} argument(s) but ${args.length} passed`,
      node
    );
  }

  // Build the semantic analyzer
  const analyzer = grammar.createSemantics().addOperation("analyze", {
    // A Storm program is a sequence of statements.
    Program(statements) {
      // Analyze each statement, discarding any nulls (e.g. comments)
      const stmts = statements.children.map(s => s.analyze()).filter(s => s !== null);
      return core.program(stmts);
    },

    // Statements  <--------
    // Variable declaration ==> set LHS to Expression
    VarDecl(_set, _ws1, lhs, _ws2, _to, _ws3, expr) {
      // The left-hand side must be a plain identifier or property. For declaration, we expect an identifier.
      const name = lhs.sourceString;  
      checkNotDeclared(name, lhs);
      const value = expr.analyze();
      // In Storm, newly declared variables are always mutable
      const variable = core.variable(name, value.type, true);
      context.add(name, variable);
      return core.variableDeclaration(variable, value);
    },

    // Function declaration ==>   set program id (ParameterList?) Block end program
    FunctionDecl(_set, _ws1, _program, _ws2, id, _openParen, params, _closeParen, _wsA, block, _wsB, _end, _wsC, _program2) {
      checkNotDeclared(id.sourceString, id);
      // Push a child context for parameters + function body
      const oldContext = context;
      context = context.newChildContext();
      let parameters = [];
      // Only nonempty if we actually have parameters
      if (params.children.length > 0) {
        parameters = params.analyze();
      }
      const body = block.analyze();
      // Storm treats function returns as "void" by default
      const func = core.functionDeclaration(id.sourceString, parameters, "void", body);
      // Store it in the parent context
      oldContext.add(id.sourceString, func);
      // Pop context
      context = oldContext;
      return func;
    },

    // Object declaration ==>  set object id (ParameterList?) Block end object
    ObjectDecl(_set, _ws1, _object, _ws2, id, _openParen, params, _closeParen, _wsA, block, _wsB, _end, _wsC, _object2) {
      checkNotDeclared(id.sourceString, id);
      // Push a new child context
      const oldContext = context;
      context = context.newChildContext();
      let parameters = [];
      if (params.children.length > 0) {
        parameters = params.analyze();
      }
      const body = block.analyze();
      const obj = core.objectDeclaration(id.sourceString, parameters, body);
      oldContext.add(id.sourceString, obj);
      // Pop context
      context = oldContext;
      return obj;
    },

    // Loop statement (“lap”) ==>  start lap LoopModifier Block lap
    LoopStmt(_start, _ws1, _lap, _ws2, modifier, _ws3, block, _ws4, _lap2) {
      let loopModifier;
      // If the parse node is 'forever', no condition is needed. Otherwise, it’s a boolean condition.
      if (modifier.ctorName === "forever") {
        loopModifier = { type: "forever" };
      } else {
        loopModifier = modifier.analyze();
        checkBoolean(loopModifier, modifier);
      }
      // Now create a child context that flags were in a loop
      const oldContext = context;
      context = context.newChildContext(true);
      const body = block.analyze();
      context = oldContext;
      return core.loopStatement(loopModifier, body);
    },

    // If statement ==>  if Expression Block
    IfStmt(_if, _ws1, cond, _ws2, block) {
      const condition = cond.analyze();
      checkBoolean(condition, cond);
      const body = block.analyze();
      return core.ifStatement(condition, body);
    },

    // Say statement:  say Expression
    SayStmt(_say, _ws, expr) {
      const argument = expr.analyze();
      return core.sayStatement(argument);
    },

    // Stop statement: stop running (only valid inside laps)
    StopStmt(_stop, _ws, _running) {
      check(context.inLoop, `stop running can only be used inside a lap`, _stop);
      return core.stopStatement();
    },

    // Expression statement (like a function call, etc.)
    ExpressionStmt(expr) {
      return core.expressionStatement(expr.analyze());
    },

    // A comment is ignored semantically
    Comment(_hash, _rest, _newline) {
      return null;
    },

    // Blocks, which create scopes  <-------
    Block(statements) {
      // Each block forms a new child scope
      const oldContext = context;
      context = context.newChildContext(oldContext.inLoop);
      const stmts = statements.children.map(s => s.analyze()).filter(s => s !== null);
      context = oldContext;
      return stmts;
    },

    // ---------------------------
    // LHS (left-hand side) for assignments, etc.
    // ---------------------------
    LHS(id, rest) {
      // If there’s only one child, it’s just an identifier
      if (this.children.length === 1) {
        const variable = context.lookup(id.sourceString);
        check(variable, `${id.sourceString} not declared`, id);
        return variable;
      } else {
        // For property accesses (e.g. x.y.z), we treat it as “any” type for now
        let base = context.lookup(id.sourceString);
        check(base, `${id.sourceString} not declared`, id);
        // A deeper analysis would verify each property in an object. For now, “any” is safe.
        return { type: "any" };
      }
    },

    // Expressions and operators <-------
    Expression(addExp) {
      return addExp.analyze();
    },

    // AddExp = MulExp ( _ ("+" | "-") _ MulExp )* (from the ohm for reference)
    AddExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        // chunk is: _ (operator) _ MulExp
        const op = chunk.children[1].sourceString;
        const right = chunk.children[3].analyze();
        if (op === "+") {
          // String concatenation is allowed if either is string; otherwise must be numeric
          if (left.type === "string" || right.type === "string") {
            left = core.binaryExpression("+", left, right, "string");
          } else {
            checkNumber(left, chunk.children[1]);
            checkNumber(right, chunk.children[3]);
            left = core.binaryExpression("+", left, right, "number");
          }
        } else if (op === "-") {
          checkNumber(left, chunk.children[1]);
          checkNumber(right, chunk.children[3]);
          left = core.binaryExpression("-", left, right, "number");
        } else {
          throw new Error(`Unknown operator ${op}`);
        }
      }
      return left;
    },

    // MulExp = PowExp ( _ ("*" | "/") _ PowExp )* (as above)
    MulExp(first, rest) {
      let left = first.analyze();
      for (let chunk of rest.children) {
        const op = chunk.children[1].sourceString;
        const right = chunk.children[3].analyze();
        checkNumber(left, chunk.children[1]);
        checkNumber(right, chunk.children[3]);
        if (op === "*") {
          left = core.binaryExpression("*", left, right, "number");
        } else if (op === "/") {
          left = core.binaryExpression("/", left, right, "number");
        } else {
          throw new Error(`Unknown operator ${op}`);
        }
      }
      return left;
    },

    // PowExp = PrimaryExp ( _ "^" _ PowExp )? (as above)
    PowExp(primary, maybePow) {
      let left = primary.analyze();
      // If there's an exponent part do:
      if (maybePow.children.length > 0) {
        // maybePow is: _ "^" _ PowExp
        const right = maybePow.children[3].analyze();
        checkNumber(left, maybePow.children[1]);
        checkNumber(right, maybePow.children[3]);
        left = core.binaryExpression("^", left, right, "number");
      }
      return left;
    },

    // PrimaryExp is just Postfix in this grammar  <-------
    PrimaryExp(postfix) {
      return postfix.analyze();
    },

    // Postfix expressions (function calls, property accesses) <-------
    Postfix(atom, tails) {
      let value = atom.analyze();
      for (let t of tails.children) {
        if (t.ctorName === "CallTail") {
          // Function call
          const args = t.analyze();
          checkFunction(value, t);
          checkArgumentCount(value.parameters, args, t);
          // Return type is either function's returnType or "void"
          value = core.callExpression(value, args, value.returnType || "void");
        } else if (t.ctorName === "PropTail") {
          // x.y property access: treat as type "any" for now
          value = { type: "any" };
        }
      }
      return value;
    },

    // CallTail = "(" _ CallArgList? _ ")"
    CallTail(_open, args, _close) {
      // If no args, returns empty array
      if (args.children.length === 0) return [];
      return args.analyze();
    },

    // PropTail = "." identifier
    PropTail(_dot, id) {
      // just return the property name, but above we treat the final type as "any"
      return id.sourceString;
    },

    // Call arguments <-------
    CallArgList(args) {
      // It's a list of CallArg nodes
      return args.asIteration().children.map(a => a.analyze());
    },
    CallArg(arg) {
      return arg.analyze();
    },
    NamedCallArg(id, _ws1, _to, _ws2, expr) {
      // Named parameter form (id to expr)
      return { name: id.sourceString, value: expr.analyze() };
    },
    PositionalCallArg(expr) {
      // Simple positional argument
      return expr.analyze();
    },

    // Parameter list for functions/objects <-------
    ParameterList(params) {
      // This is a comma‐separated list of identifiers
      return params.asIteration().children.map(param => {
        checkNotDeclared(param.sourceString, param);
        // We store function/object parameters as "any" for now
        const paramVar = core.variable(param.sourceString, "any", false);
        context.add(param.sourceString, paramVar);
        return paramVar;
      });
    },


    // Literals and Identifiers <-------
    NumberLiteral(numberToken) {
      return { type: "number", value: Number(numberToken.sourceString) };
    },
    StringLiteral(_open, chars, _close) {
      // The `chars.sourceString` is everything between the quotes
      return { type: "string", value: chars.sourceString };
    },
    AskLiteral(_ask, _ws, str) {
      // "ask" always returns a string
      return { type: "string", value: str.sourceString };
    },
    identifier(_first, _rest) {
      // For references, look up in context
      const variable = context.lookup(this.sourceString);
      check(variable, `${this.sourceString} not declared`, this);
      return variable;
    },
    ParenExp(_open, _ws1, expr, _ws2, _close) {
      return expr.analyze();
    }
  });

  // Run the analysis
  return analyzer(match).analyze();
}
