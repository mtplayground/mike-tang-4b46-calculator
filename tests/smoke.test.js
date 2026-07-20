"use strict";

const {
  bindCalculatorControls,
  createCalculatorEngine,
} = require("../app.js");

function assertEqual(actual, expected, label) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

function makeClassList() {
  const values = new Set();

  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function makeButton(dataset) {
  const listeners = {};

  return {
    dataset: { ...dataset },
    classList: makeClassList(),
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    click() {
      listeners.click();
    },
  };
}

function makeTestDocument() {
  const listeners = {};
  const display = { textContent: "", dataset: {} };
  const memoryIndicator = { hidden: true };
  const buttons = [
    makeButton({ action: "memory-add" }),
    makeButton({ action: "memory-subtract" }),
    makeButton({ action: "memory-recall" }),
    makeButton({ action: "clear" }),
    makeButton({ action: "percent" }),
    makeButton({ action: "operator", operator: "divide" }),
    makeButton({ action: "operator", operator: "multiply" }),
    makeButton({ action: "operator", operator: "subtract" }),
    makeButton({ action: "operator", operator: "add" }),
    makeButton({ action: "equals" }),
    makeButton({ action: "digit", value: "7" }),
    makeButton({ action: "digit", value: "8" }),
    makeButton({ action: "digit", value: "9" }),
    makeButton({ action: "digit", value: "4" }),
    makeButton({ action: "digit", value: "5" }),
    makeButton({ action: "digit", value: "6" }),
    makeButton({ action: "digit", value: "1" }),
    makeButton({ action: "digit", value: "2" }),
    makeButton({ action: "digit", value: "3" }),
    makeButton({ action: "digit", value: "0" }),
    makeButton({ action: "decimal" }),
  ];

  const root = {
    querySelector(selector) {
      if (selector === "#calculator-display") return display;
      if (selector === "#memory-indicator") return memoryIndicator;
      return null;
    },
    querySelectorAll(selector) {
      return selector === "button[data-action]" ? buttons : [];
    },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
  };

  function findButton(action, matcher = () => true) {
    const button = buttons.find((candidate) => (
      candidate.dataset.action === action && matcher(candidate.dataset)
    ));

    if (!button) {
      throw new Error(`Missing test button for ${action}`);
    }

    return button;
  }

  function pressDigit(value) {
    findButton("digit", (dataset) => dataset.value === String(value)).click();
  }

  function pressOperator(operator) {
    findButton("operator", (dataset) => dataset.operator === operator).click();
  }

  function pressAction(action) {
    findButton(action).click();
  }

  function keydown(key) {
    listeners.keydown({
      key,
      target: null,
      defaultPrevented: false,
      preventDefault() {},
    });
  }

  return {
    display,
    memoryIndicator,
    pressAction,
    pressDigit,
    pressOperator,
    root,
    keydown,
  };
}

function withConsoleErrorCapture(callback) {
  const originalConsoleError = console.error;
  const errors = [];

  console.error = (...args) => {
    errors.push(args);
  };

  try {
    callback();
  } finally {
    console.error = originalConsoleError;
  }

  assertEqual(errors.length, 0, "console errors during smoke test");
}

function runSmokeTest() {
  const engine = createCalculatorEngine();
  const testDocument = makeTestDocument();
  const binding = bindCalculatorControls(testDocument.root, engine);

  assertEqual(binding.bound, true, "button binding");
  assertEqual(binding.keyboardBound, true, "keyboard binding");
  assertEqual(binding.buttonCount, 21, "bound button count");
  assertEqual(testDocument.display.textContent, "0", "initial display");

  testDocument.pressDigit(1);
  testDocument.pressDigit(2);
  testDocument.pressOperator("add");
  testDocument.pressDigit(3);
  testDocument.pressOperator("multiply");
  assertEqual(testDocument.display.textContent, "15", "chained arithmetic intermediate");
  testDocument.pressDigit(2);
  testDocument.pressAction("equals");
  assertEqual(testDocument.display.textContent, "30", "chained arithmetic result");

  testDocument.pressAction("clear");
  testDocument.pressDigit(1);
  testDocument.pressAction("decimal");
  testDocument.pressDigit(2);
  testDocument.pressAction("decimal");
  testDocument.pressDigit(3);
  assertEqual(testDocument.display.textContent, "1.23", "decimal duplicate prevention");
  testDocument.pressAction("clear");
  assertEqual(testDocument.display.textContent, "0", "clear after decimal entry");

  testDocument.pressDigit(8);
  testDocument.pressOperator("divide");
  testDocument.pressDigit(0);
  testDocument.pressAction("equals");
  assertEqual(testDocument.display.textContent, "Cannot divide by 0", "divide-by-zero message");
  testDocument.pressAction("clear");
  testDocument.pressDigit(4);
  assertEqual(testDocument.display.textContent, "4", "divide-by-zero recovery");

  testDocument.pressAction("clear");
  testDocument.pressDigit(2);
  testDocument.pressDigit(0);
  testDocument.pressDigit(0);
  testDocument.pressOperator("add");
  testDocument.pressDigit(1);
  testDocument.pressDigit(0);
  testDocument.pressAction("percent");
  testDocument.pressAction("equals");
  assertEqual(testDocument.display.textContent, "220", "percentage operator flow");

  testDocument.pressAction("clear");
  testDocument.pressDigit(1);
  testDocument.pressDigit(2);
  testDocument.pressAction("memory-add");
  assertEqual(testDocument.memoryIndicator.hidden, false, "memory indicator after M+");
  testDocument.pressAction("clear");
  testDocument.pressDigit(5);
  testDocument.pressAction("memory-subtract");
  testDocument.pressAction("clear");
  testDocument.pressAction("memory-recall");
  assertEqual(testDocument.display.textContent, "7", "memory recall after M+ and M-");

  testDocument.pressAction("clear");
  testDocument.keydown("6");
  testDocument.keydown("*");
  testDocument.keydown("7");
  testDocument.keydown("Enter");
  assertEqual(testDocument.display.textContent, "42", "keyboard multiply flow");
  testDocument.keydown("Escape");
  assertEqual(testDocument.display.textContent, "0", "keyboard clear");
  testDocument.keydown(".");
  testDocument.keydown("5");
  testDocument.keydown("%");
  assertEqual(testDocument.display.textContent, "0.005", "keyboard decimal percent");

  assert(
    testDocument.display.dataset.state === "ready",
    "display should finish in ready state",
  );
}

withConsoleErrorCapture(runSmokeTest);
console.log("smoke test passed");
