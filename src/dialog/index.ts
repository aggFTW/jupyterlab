// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.


import {
  Message
} from 'phosphor/lib/core/messaging';

import {
  Panel
} from 'phosphor/lib/ui/panel';


import {
  Widget
} from 'phosphor/lib/ui/widget';

/**
 * The class name added to dialog instances.
 */
const DIALOG_CLASS = 'jp-Dialog';

/**
 * The class name added to dialog content node.
 */
const CONTENT_CLASS = 'jp-Dialog-content';

/**
 * The class name added to dialog header node.
 */
const HEADER_CLASS = 'jp-Dialog-header';

/**
 * The class name added to dialog title node.
 */
const TITLE_CLASS = 'jp-Dialog-title';

/**
 * The class name added to dialog body node.
 */
const BODY_CLASS = 'jp-Dialog-body';

/**
 * The class name added to a dialog body content node.
 */
const BODY_CONTENT_CLASS = 'jp-Dialog-bodyContent';

/**
 * The class name added to a dialog content node.
 */
const FOOTER_CLASS = 'jp-Dialog-footer';

/**
 * The class name added to a dialog button node.
 */
const BUTTON_CLASS = 'jp-Dialog-button';

/**
 * The class name added to a dialog button icon node.
 */
const BUTTON_ICON_CLASS = 'jp-Dialog-buttonIcon';

/**
 * The class name added to a dialog button text node.
 */
const BUTTON_TEXT_CLASS = 'jp-Dialog-buttonText';

/*
 * The class name added to dialog Confirm buttons.
 */
const OK_BUTTON_CLASS = 'jp-Dialog-okButton';

/**
 * The class name added to dialog Cancel buttons.
 */
const CANCEL_BUTTON_CLASS = 'jp-Dialog-cancelButton';

/**
 * The class name added to dialog input field wrappers.
 */
const INPUT_WRAPPER_CLASS = 'jp-Dialog-inputWrapper';

/**
 * The class name added to dialog input fields.
 */
const INPUT_CLASS = 'jp-Dialog-input';

/**
 * The class name added to dialog select wrappers.
 */
const SELECT_WRAPPER_CLASS = 'jp-Dialog-selectWrapper';

/**
 * The class name added to dialog select nodes.
 */
const SELECT_CLASS = 'jp-Dialog-select';


/**
 * A button applied to a dialog.
 */
export
interface IButtonItem {
  /**
   * The text for the button.
   */
  text: string;

  /**
   * The icon class for the button.
   */
  icon?: string;

  /**
   * The extra class name to associate with the button.
   */
  className?: string;
}


/**
 * A default confirmation button.
 */
export
const okButton: IButtonItem = {
  text: 'OK',
  className: OK_BUTTON_CLASS
};


/**
 * A default cancel button.
 */
export
const cancelButton: IButtonItem = {
  text: 'CANCEL',
  className: CANCEL_BUTTON_CLASS
};


/**
 * The options used to create a dialog.
 */
export
interface IDialogOptions {
  /**
   * The tope level text for the dialog (defaults to an empty string).
   */
  title?: string;

  /**
   * The main body element for the dialog or a message to display.
   *
   * #### Notes
   * If a `string` is provided, it will be used as the `HTMLContent` of
   * a `<span>`.  If an `<input>` or `<select>` element is provided,
   * they will be styled.
   */
  body?: Widget | HTMLElement | string;

  /**
   * The host element for the dialog (defaults to `document.body`).
   */
  host?: HTMLElement;

  /**
   * A list of button types to display (defaults to [[okButton]] and
   *   [[cancelButton]]).
   */
  buttons?: IButtonItem[];

  /**
   * The confirmation text for the OK button (defaults to 'OK').
   */
  okText?: string;

  /**
   * An additional CSS class to apply to the dialog.
   */
  dialogClass?: string;
}


/**
 * Create a dialog and show it.
 *
 * @param options - The dialog setup options.
 *
 * @returns A promise that resolves to the button item that was selected.
 */
export
function showDialog(options?: IDialogOptions): Promise<IButtonItem> {
  options = options || {};
  let host = options.host || document.body;
  options.host = host;
  options.body = options.body || '';
  // NOTE: This code assumes only one dialog is shown at the time:
  okButton.text = options.okText ? options.okText : 'OK';
  options.buttons = options.buttons || [cancelButton, okButton];
  if (!(options.body instanceof Widget)) {
    options.body = createDialogBody(options.body);
  }
  return new Promise<IButtonItem>((resolve, reject) => {
    let dialog = new Dialog(options, resolve, reject);
    Widget.attach(dialog, host);
  });
}

/**
 * A dialog panel.
 */
class Dialog extends Panel {
  /**
   * Create a dialog panel instance.
   *
   * @param options - The dialog setup options.
   *
   * @param resolve - The function that resolves the dialog promise.
   *
   * @param reject - The function that rejects the dialog promise.
   *
   * #### Notes
   * Currently the dialog resolves with `cancelButton` rather than
   * rejecting the dialog promise.
   */
  constructor(options: IDialogOptions, resolve: (value: IButtonItem) => void, reject?: (error: any) => void) {
    super();

    if (!(options.body instanceof Widget)) {
      throw 'A widget dialog can only be created with a widget as its body.';
    }

    this.resolve = resolve;
    this.reject = reject;

    // Create the dialog nodes (except for the buttons).
    let content = new Panel();
    let header = new Widget({node: document.createElement('div')});
    let body = new Panel();
    let footer = new Widget({node: document.createElement('div')});
    let title = document.createElement('span');
    this.addClass(DIALOG_CLASS);
    if (options.dialogClass) {
      this.addClass(options.dialogClass);
    }
    content.addClass(CONTENT_CLASS);
    header.addClass(HEADER_CLASS);
    body.addClass(BODY_CLASS);
    footer.addClass(FOOTER_CLASS);
    title.className = TITLE_CLASS;
    this.addWidget(content);
    content.addWidget(header);
    content.addWidget(body);
    content.addWidget(footer);
    header.node.appendChild(title);

    // Populate the nodes.
    title.textContent = options.title || '';
    let child = options.body as Widget;
    child.addClass(BODY_CONTENT_CLASS);
    body.addWidget(child);
    this._buttons = options.buttons;
    this._buttonNodes = options.buttons.map(createButton);
    this._buttonNodes.map(buttonNode => {
      footer.node.appendChild(buttonNode);
    });
  }

  /**
   * Handle the DOM events for the directory listing.
   *
   * @param event - The DOM event sent to the widget.
   *
   * #### Notes
   * This method implements the DOM `EventListener` interface and is
   * called in response to events on the panel's DOM node. It should
   * not be called directly by user code.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
    case 'keydown':
      this.evtKeydown(event as KeyboardEvent);
      break;
    case 'contextmenu':
      this.evtContextMenu(event as MouseEvent);
      break;
    default:
      break;
    }
  }

  /**
   * Handle an `'after-attach'` message to the widget.
   *
   * @param msg - The `'after-attach'` message
   */
  protected onAfterAttach(msg: Message): void {
    let node = this.node;
    node.addEventListener('keydown', this, true);
    node.addEventListener('contextmenu', this, true);
    node.addEventListener('click', this);
    this._buttonNodes.map(buttonNode => {
      buttonNode.addEventListener('click', this.evtButtonClick.bind(this));
    });

    // Focus the ok button if given.
    let index = this._buttons.indexOf(okButton);
    if (index !== -1) {
      this._buttonNodes[index].focus();
    }
  }

  /**
   * Handle the `'click'` event for a dialog button.
   *
   * @param event - The DOM event sent to the widget
   */
  protected evtButtonClick(event: MouseEvent): void {
    for (let buttonNode of this._buttonNodes) {
      if (buttonNode.contains(event.target as HTMLElement)) {
        this.close();
        let button = this._buttons[this._buttonNodes.indexOf(buttonNode)];
        this.resolve(button);
      }
    }
  }

  /**
   * Handle the `'keydown'` event for the widget.
   *
   * @param event - The DOM event sent to the widget
   */
  protected evtKeydown(event: KeyboardEvent): void {
    // Check for escape key
    if (event.keyCode === 27) {
      this.close();
      this.resolve(cancelButton);
    }
  }

  /**
   * Handle the `'contextmenu'` event for the widget.
   *
   * @param event - The DOM event sent to the widget
   */
  protected evtContextMenu(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * The resolution function of the dialog Promise.
   */
  protected resolve: (value: IButtonItem) => void;

  /**
   * The rejection function of the dialog Promise.
   */
  protected reject: (error: any) => void;

  private _buttonNodes: HTMLElement[];
  private _buttons: IButtonItem[];
}


/**
 * Create a dialog body widget from a non-widget input.
 */
function createDialogBody(body: HTMLElement | string): Widget {
  let child: HTMLElement;
  if (typeof body === 'string') {
    child = document.createElement('span');
    child.innerHTML = body as string;
  } else if (body) {
    child = body as HTMLElement;
    switch (child.tagName) {
    case 'INPUT':
      child = wrapInput(child as HTMLInputElement);
      break;
    case 'SELECT':
      child = wrapSelect(child as HTMLSelectElement);
      break;
    default:
      child = styleElements(child);
      break;
    }
  }
  child.classList.add(BODY_CONTENT_CLASS);
  return new Widget({node: child});
}


/**
 * Style the child elements of a parent element.
 */
function styleElements(element: HTMLElement): HTMLElement {
  for (let i = 0; i < element.children.length; i++) {
    let child = element.children[i];
    let next = child.nextSibling;
    switch (child.tagName) {
    case 'INPUT':
      child = wrapInput(child as HTMLInputElement);
      element.insertBefore(child, next);
      break;
    case 'SELECT':
      child = wrapSelect(child as HTMLSelectElement);
      element.insertBefore(child, next);
      break;
    default:
      break;
    }
  }
  return element;
}


/**
 * Create a node for a button item.
 */
function createButton(item: IButtonItem): HTMLElement {
  let button = document.createElement('button');
  button.className = BUTTON_CLASS;
  button.tabIndex = -1;
  if (item.className) {
    button.classList.add(item.className);
  }
  let icon = document.createElement('span');
  icon.className = BUTTON_ICON_CLASS;
  if (item.icon) {
    icon.classList.add(item.icon);
  }
  let text = document.createElement('span');
  text.className = BUTTON_TEXT_CLASS;
  text.textContent = item.text;
  button.appendChild(icon);
  button.appendChild(text);
  return button;
}


/**
 * Wrap and style an input node.
 */
function wrapInput(input: HTMLInputElement): HTMLElement {
  let wrapper = document.createElement('div');
  wrapper.className = INPUT_WRAPPER_CLASS;
  wrapper.appendChild(input);
  input.classList.add(INPUT_CLASS);
  return wrapper;
}


/**
 * Wrap and style a select node.
 */
function wrapSelect(select: HTMLSelectElement): HTMLElement {
  let wrapper = document.createElement('div');
  wrapper.className = SELECT_WRAPPER_CLASS;
  wrapper.appendChild(select);
  select.classList.add(SELECT_CLASS);
  return wrapper;
}
