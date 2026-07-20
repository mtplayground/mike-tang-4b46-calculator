(function initializeCalculator(globalScope) {
  "use strict";

  const DISPLAY_MAX_LENGTH = 12;
  const GENERIC_ERROR_MESSAGE = "Error";
  const DIVIDE_BY_ZERO_MESSAGE = "Cannot divide by 0";

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
      error: null,
    };
  }

  function trimFormattedNumber(value) {
    return value
      .replace(/(\.\d*?)0+(e|$)/, "$1$2")
      .replace(/\.(e|$)/, "$1")
      .replace("e+", "e");
  }

  function formatNumberForDisplay(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return GENERIC_ERROR_MESSAGE;
    }

    if (Object.is(number, -0)) {
      return "0";
    }

    const integerText = String(Math.trunc(Math.abs(number)));
    const signLength = number < 0 ? 1 : 0;
    const wholeNumberLength = integerText.length + signLength;
    const rawText = String(number);

    if (!rawText.includes("e") && rawText.length <= DISPLAY_MAX_LENGTH) {
      return rawText;
    }

    const absoluteNumber = Math.abs(number);

    if (absoluteNumber !== 0 && (absoluteNumber >= 1e12 || absoluteNumber < 1e-6)) {
      return trimFormattedNumber(number.toExponential(6));
    }

    const availableFractionDigits = DISPLAY_MAX_LENGTH - wholeNumberLength - 1;

    if (availableFractionDigits > 0) {
      const fixedText = trimFormattedNumber(number.toFixed(Math.min(8, availableFractionDigits)));

      if (fixedText.length <= DISPLAY_MAX_LENGTH) {
        return fixedText;
      }
    }

    return trimFormattedNumber(number.toPrecision(8));
  }

  function formatOperandForDisplay(value) {
    const text = String(value);

    if (/^-?\d+\.\d*$/.test(text) && text.length <= DISPLAY_MAX_LENGTH) {
      return text;
    }

    return formatNumberForDisplay(value);
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

    function setCurrentOperand(value, options = {}) {
      state.currentOperand = String(value);
      state.displayValue = options.preserveInput
        ? formatOperandForDisplay(value)
        : formatNumberForDisplay(value);
    }

    function resetState() {
      Object.assign(state, createInitialState());
    }

    function setError(message) {
      state.currentOperand = "0";
      state.storedValue = null;
      state.pendingOperator = null;
      state.waitingForOperand = true;
      state.displayValue = message;
      state.error = message;
    }

    function applyPendingOperation(inputValue) {
      if (state.pendingOperator === "divide" && inputValue === 0) {
        setError(DIVIDE_BY_ZERO_MESSAGE);
        return false;
      }

      const result = calculateResult(state.storedValue, state.pendingOperator, inputValue);

      if (!Number.isFinite(result)) {
        setError(GENERIC_ERROR_MESSAGE);
        return false;
      }

      state.storedValue = result;
      setCurrentOperand(result);
      return true;
    }

    function snapshot() {
      return {
        currentOperand: state.currentOperand,
        storedValue: state.storedValue,
        pendingOperator: state.pendingOperator,
        waitingForOperand: state.waitingForOperand,
        displayValue: state.displayValue,
        error: state.error,
      };
    }

    function inputDigit(digit) {
      const value = normalizeDigit(digit);

      if (state.error) {
        return snapshot();
      }

      if (state.waitingForOperand) {
        if (state.pendingOperator === null) {
          state.storedValue = null;
        }

        setCurrentOperand(value, { preserveInput: true });
        state.waitingForOperand = false;
        return snapshot();
      }

      setCurrentOperand(state.currentOperand === "0" ? value : state.currentOperand + value, {
        preserveInput: true,
      });
      return snapshot();
    }

    function inputDecimal() {
      if (state.error) {
        return snapshot();
      }

      if (state.waitingForOperand) {
        if (state.pendingOperator === null) {
          state.storedValue = null;
        }

        setCurrentOperand("0.", { preserveInput: true });
        state.waitingForOperand = false;
        return snapshot();
      }

      if (state.currentOperand.includes(".")) {
        return snapshot();
      }

      setCurrentOperand(`${state.currentOperand}.`, { preserveInput: true });
      return snapshot();
    }

    function chooseOperator(operator) {
      const nextOperator = normalizeOperator(operator);

      if (state.error) {
        return snapshot();
      }

      const inputValue = Number(state.currentOperand);

      if (state.pendingOperator && !state.waitingForOperand) {
        if (!applyPendingOperation(inputValue)) {
          return snapshot();
        }
      } else if (state.storedValue === null) {
        state.storedValue = inputValue;
      }

      state.pendingOperator = nextOperator;
      state.waitingForOperand = true;

      return snapshot();
    }

    function calculate() {
      if (state.error) {
        return snapshot();
      }

      if (!state.pendingOperator || state.storedValue === null || state.waitingForOperand) {
        return snapshot();
      }

      const inputValue = Number(state.currentOperand);

      if (!applyPendingOperation(inputValue)) {
        return snapshot();
      }

      state.pendingOperator = null;
      state.waitingForOperand = true;

      return snapshot();
    }

    function clear() {
      resetState();
      return snapshot();
    }

    return {
      inputDigit,
      inputDecimal,
      chooseOperator,
      calculate,
      clear,
      reset: clear,
      getDisplayValue() {
        return state.displayValue;
      },
      getState: snapshot,
    };
  }

  const calculatorEngine = createCalculatorEngine();
  const pressFeedbackTimers = new WeakMap();

  function dispatchCalculatorAction(engine, action, data = {}) {
    switch (action) {
      case "digit":
        return engine.inputDigit(data.value);
      case "decimal":
        return engine.inputDecimal();
      case "operator":
        return engine.chooseOperator(data.operator);
      case "equals":
        return engine.calculate();
      case "clear":
        return engine.clear();
      case "percent":
        return engine.getState();
      default:
        return engine.getState();
    }
  }

  function updateDisplay(displayElement, state) {
    displayElement.textContent = state.displayValue;
    displayElement.dataset.state = state.error ? "error" : "ready";
  }

  function showPressFeedback(button) {
    if (pressFeedbackTimers.has(button)) {
      globalScope.clearTimeout(pressFeedbackTimers.get(button));
    }

    button.classList.add("is-pressing");
    pressFeedbackTimers.set(
      button,
      globalScope.setTimeout(() => {
        button.classList.remove("is-pressing");
        pressFeedbackTimers.delete(button);
      }, 140),
    );
  }

  function bindCalculatorControls(root, engine = calculatorEngine) {
    const displayElement = root.querySelector("#calculator-display");
    const buttons = Array.from(root.querySelectorAll("button[data-action]"));

    if (!displayElement || buttons.length === 0) {
      return {
        bound: false,
        buttonCount: 0,
      };
    }

    updateDisplay(displayElement, engine.getState());

    buttons.forEach((button) => {
      if (button.dataset.calculatorBound === "true") {
        return;
      }

      button.dataset.calculatorBound = "true";

      button.addEventListener("pointerdown", () => {
        showPressFeedback(button);
      });

      button.addEventListener("click", () => {
        showPressFeedback(button);

        try {
          const state = dispatchCalculatorAction(engine, button.dataset.action, {
            operator: button.dataset.operator,
            value: button.dataset.value,
          });
          updateDisplay(displayElement, state);
        } catch (error) {
          console.error("Calculator input failed", error);
          updateDisplay(displayElement, {
            displayValue: GENERIC_ERROR_MESSAGE,
            error: GENERIC_ERROR_MESSAGE,
          });
        }
      });
    });

    return {
      bound: true,
      buttonCount: buttons.length,
    };
  }

  function startBrowserApp() {
    if (!globalScope.document) {
      return;
    }

    bindCalculatorControls(globalScope.document);
    globalScope.document.documentElement.dataset.appReady = "true";
  }

  globalScope.CalculatorEngine = {
    create: createCalculatorEngine,
    dispatchAction: dispatchCalculatorAction,
    bindControls: bindCalculatorControls,
  };
  globalScope.calculatorEngine = calculatorEngine;

  if (globalScope.document) {
    if (globalScope.document.readyState === "loading") {
      globalScope.document.addEventListener("DOMContentLoaded", startBrowserApp, { once: true });
    } else {
      startBrowserApp();
    }
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      bindCalculatorControls,
      createCalculatorEngine,
      dispatchCalculatorAction,
      formatNumberForDisplay,
    };
  }
})(typeof globalThis === "object" ? globalThis : window);
