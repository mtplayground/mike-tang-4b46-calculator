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
      memoryValue: 0,
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
      const memoryValue = state.memoryValue;
      Object.assign(state, createInitialState(), { memoryValue });
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

    function calculatePercentValue(inputValue) {
      if (
        state.storedValue !== null
        && (state.pendingOperator === "add" || state.pendingOperator === "subtract")
      ) {
        return state.storedValue * (inputValue / 100);
      }

      return inputValue / 100;
    }

    function snapshot() {
      return {
        currentOperand: state.currentOperand,
        storedValue: state.storedValue,
        pendingOperator: state.pendingOperator,
        waitingForOperand: state.waitingForOperand,
        displayValue: state.displayValue,
        error: state.error,
        memoryValue: state.memoryValue,
        memoryActive: state.memoryValue !== 0,
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

    function applyPercent() {
      if (state.error) {
        return snapshot();
      }

      const inputValue = Number(state.currentOperand);
      const percentValue = calculatePercentValue(inputValue);

      if (!Number.isFinite(percentValue)) {
        setError(GENERIC_ERROR_MESSAGE);
        return snapshot();
      }

      setCurrentOperand(percentValue);
      state.waitingForOperand = false;

      return snapshot();
    }

    function setMemoryValue(value) {
      state.memoryValue = Object.is(value, -0) ? 0 : value;
    }

    function addToMemory() {
      if (state.error) {
        return snapshot();
      }

      const result = state.memoryValue + Number(state.currentOperand);

      if (!Number.isFinite(result)) {
        setError(GENERIC_ERROR_MESSAGE);
        return snapshot();
      }

      setMemoryValue(result);
      return snapshot();
    }

    function subtractFromMemory() {
      if (state.error) {
        return snapshot();
      }

      const result = state.memoryValue - Number(state.currentOperand);

      if (!Number.isFinite(result)) {
        setError(GENERIC_ERROR_MESSAGE);
        return snapshot();
      }

      setMemoryValue(result);
      return snapshot();
    }

    function recallMemory() {
      if (state.error) {
        return snapshot();
      }

      if (state.pendingOperator === null) {
        state.storedValue = null;
      }

      setCurrentOperand(state.memoryValue);
      state.waitingForOperand = false;

      return snapshot();
    }

    function clear() {
      resetState();
      return snapshot();
    }

    return {
      inputDigit,
      inputDecimal,
      applyPercent,
      addToMemory,
      chooseOperator,
      calculate,
      clear,
      recallMemory,
      reset: clear,
      subtractFromMemory,
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
        return engine.applyPercent();
      case "memory-add":
        return engine.addToMemory();
      case "memory-subtract":
        return engine.subtractFromMemory();
      case "memory-recall":
        return engine.recallMemory();
      default:
        return engine.getState();
    }
  }

  function isEditableTarget(target) {
    if (!target) {
      return false;
    }

    const tagName = target.tagName;

    return target.isContentEditable
      || tagName === "INPUT"
      || tagName === "TEXTAREA"
      || tagName === "SELECT";
  }

  function mapKeyboardEventToAction(event) {
    if (
      event.defaultPrevented
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || isEditableTarget(event.target)
    ) {
      return null;
    }

    const key = event.key;

    if (/^[0-9]$/.test(key)) {
      return {
        action: "digit",
        data: { value: key },
      };
    }

    if (key === "." || key === "Decimal") {
      return { action: "decimal" };
    }

    if (key === "%") {
      return { action: "percent" };
    }

    if (key === "Enter" || key === "=") {
      return { action: "equals" };
    }

    if (key === "Escape" || key === "c" || key === "C") {
      return { action: "clear" };
    }

    if (key === "+") {
      return {
        action: "operator",
        data: { operator: "add" },
      };
    }

    if (key === "-" || key === "−") {
      return {
        action: "operator",
        data: { operator: "subtract" },
      };
    }

    if (key === "*") {
      return {
        action: "operator",
        data: { operator: "multiply" },
      };
    }

    if (key === "/") {
      return {
        action: "operator",
        data: { operator: "divide" },
      };
    }

    return null;
  }

  function findButtonForAction(buttons, mappedAction) {
    return buttons.find((button) => {
      if (button.dataset.action !== mappedAction.action) {
        return false;
      }

      if (mappedAction.action === "digit") {
        return button.dataset.value === mappedAction.data.value;
      }

      if (mappedAction.action === "operator") {
        return button.dataset.operator === mappedAction.data.operator;
      }

      return true;
    });
  }

  function updateDisplay(displayElement, state, memoryIndicator) {
    displayElement.textContent = state.displayValue;
    displayElement.dataset.state = state.error ? "error" : "ready";

    if (memoryIndicator) {
      memoryIndicator.hidden = !state.memoryActive;
    }
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

  function bindKeyboardControls(root, engine, displayElement, memoryIndicator, buttons) {
    if (root.calculatorKeyboardBound === true || typeof root.addEventListener !== "function") {
      return false;
    }

    root.calculatorKeyboardBound = true;

    root.addEventListener("keydown", (event) => {
      const mappedAction = mapKeyboardEventToAction(event);

      if (!mappedAction) {
        return;
      }

      event.preventDefault();

      const matchingButton = findButtonForAction(buttons, mappedAction);

      if (matchingButton) {
        showPressFeedback(matchingButton);
      }

      try {
        const state = dispatchCalculatorAction(engine, mappedAction.action, mappedAction.data);
        updateDisplay(displayElement, state, memoryIndicator);
      } catch (error) {
        console.error("Calculator keyboard input failed", error);
        updateDisplay(displayElement, {
          displayValue: GENERIC_ERROR_MESSAGE,
          error: GENERIC_ERROR_MESSAGE,
        }, memoryIndicator);
      }
    });

    return true;
  }

  function bindCalculatorControls(root, engine = calculatorEngine) {
    const displayElement = root.querySelector("#calculator-display");
    const memoryIndicator = root.querySelector("#memory-indicator");
    const buttons = Array.from(root.querySelectorAll("button[data-action]"));

    if (!displayElement || buttons.length === 0) {
      return {
        bound: false,
        buttonCount: 0,
      };
    }

    updateDisplay(displayElement, engine.getState(), memoryIndicator);

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
          updateDisplay(displayElement, state, memoryIndicator);
        } catch (error) {
          console.error("Calculator input failed", error);
          updateDisplay(displayElement, {
            displayValue: GENERIC_ERROR_MESSAGE,
            error: GENERIC_ERROR_MESSAGE,
          }, memoryIndicator);
        }
      });
    });

    const keyboardBound = bindKeyboardControls(root, engine, displayElement, memoryIndicator, buttons);

    return {
      bound: true,
      buttonCount: buttons.length,
      keyboardBound,
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
    mapKeyboardEvent: mapKeyboardEventToAction,
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
      mapKeyboardEventToAction,
    };
  }
})(typeof globalThis === "object" ? globalThis : window);
