(function initializeCalculator(globalScope) {
  "use strict";

  const OPERATIONS = {
    add(left, right) {
      return left + right;
    },
    subtract(left, right) {
      return left - right;
    },
    multiply(left, right) {
      return left * right;
    },
    divide(left, right) {
      return left / right;
    },
  };

  function createInitialState() {
    return {
      currentOperand: "0",
      storedValue: null,
      pendingOperator: null,
      waitingForOperand: false,
      displayValue: "0",
    };
  }

  function normalizeDigit(digit) {
    const value = String(digit);

    if (!/^[0-9]$/.test(value)) {
      throw new TypeError("Digit input must be a single number from 0 to 9.");
    }

    return value;
  }

  function normalizeOperator(operator) {
    if (!Object.prototype.hasOwnProperty.call(OPERATIONS, operator)) {
      throw new TypeError(`Unsupported operator: ${operator}`);
    }

    return operator;
  }

  function calculateResult(left, operator, right) {
    return OPERATIONS[operator](left, right);
  }

  function createCalculatorEngine() {
    const state = createInitialState();

    function setCurrentOperand(value) {
      state.currentOperand = String(value);
      state.displayValue = state.currentOperand;
    }

    function snapshot() {
      return {
        currentOperand: state.currentOperand,
        storedValue: state.storedValue,
        pendingOperator: state.pendingOperator,
        waitingForOperand: state.waitingForOperand,
        displayValue: state.displayValue,
      };
    }

    function inputDigit(digit) {
      const value = normalizeDigit(digit);

      if (state.waitingForOperand) {
        setCurrentOperand(value);
        state.waitingForOperand = false;
        return snapshot();
      }

      setCurrentOperand(state.currentOperand === "0" ? value : state.currentOperand + value);
      return snapshot();
    }

    function chooseOperator(operator) {
      const nextOperator = normalizeOperator(operator);
      const inputValue = Number(state.currentOperand);

      if (state.pendingOperator && !state.waitingForOperand) {
        const result = calculateResult(state.storedValue, state.pendingOperator, inputValue);
        state.storedValue = result;
        setCurrentOperand(result);
      } else if (state.storedValue === null) {
        state.storedValue = inputValue;
      }

      state.pendingOperator = nextOperator;
      state.waitingForOperand = true;

      return snapshot();
    }

    function calculate() {
      if (!state.pendingOperator || state.storedValue === null || state.waitingForOperand) {
        return snapshot();
      }

      const inputValue = Number(state.currentOperand);
      const result = calculateResult(state.storedValue, state.pendingOperator, inputValue);

      state.storedValue = result;
      state.pendingOperator = null;
      state.waitingForOperand = true;
      setCurrentOperand(result);

      return snapshot();
    }

    return {
      inputDigit,
      chooseOperator,
      calculate,
      getDisplayValue() {
        return state.displayValue;
      },
      getState: snapshot,
    };
  }

  const calculatorEngine = createCalculatorEngine();

  globalScope.CalculatorEngine = {
    create: createCalculatorEngine,
  };
  globalScope.calculatorEngine = calculatorEngine;

  if (globalScope.document) {
    globalScope.document.documentElement.dataset.appReady = "true";
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      createCalculatorEngine,
    };
  }
})(typeof globalThis === "object" ? globalThis : window);
