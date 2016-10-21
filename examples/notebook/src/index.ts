// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  NotebookPanel, NotebookWidgetFactory,
  NotebookModelFactory, NotebookActions
} from 'jupyterlab/lib/notebook';

import {
  CodeMirrorNotebookPanelRenderer
} from 'jupyterlab/lib/notebook/codemirror/notebook/panel';

import {
  IServiceManager, ServiceManager, IAjaxSettings, Kernel
} from 'jupyter-js-services';

import {
  DocumentManager
} from 'jupyterlab/lib/docmanager';

import {
  DocumentRegistry, restartKernel, selectKernelForContext
} from 'jupyterlab/lib/docregistry';

import {
  RenderMime
} from 'jupyterlab/lib/rendermime';

import {
  HTMLRenderer, LatexRenderer, ImageRenderer, TextRenderer,
  JavascriptRenderer, SVGRenderer, MarkdownRenderer
} from 'jupyterlab/lib/renderers';

import {
  defaultSanitizer
} from 'jupyterlab/lib/sanitizer';

import {
  MimeData
} from 'phosphor/lib/core/mimedata';

import {
  CommandRegistry
} from 'phosphor/lib/ui/commandregistry';

import {
  CommandPalette
} from 'phosphor/lib/ui/commandpalette';

import {
  Keymap
} from 'phosphor/lib/ui/keymap';

import {
  SplitPanel
} from 'phosphor/lib/ui/splitpanel';

import {
  Widget
} from 'phosphor/lib/ui/widget';

import {
  IWidgetExtension, IDocumentContext, IDocumentModel, IDocumentRegistry
} from 'jupyterlab/lib/docregistry';

import {
  INotebookModel
} from 'jupyterlab/lib/notebook/notebook/model';

import {
  JupyterLabPlugin, JupyterLab
} from 'jupyterlab/lib/application';

import {
  IKernel
} from 'jupyter-js-services';

import {
  IDisposable, DisposableDelegate
} from 'phosphor/lib/core/disposable';

import {
  Token
} from 'phosphor/lib/core/token';

import {
  WidgetManager, WidgetRenderer
} from 'jupyterlab_widgets';

import 'jupyterlab/lib/default-theme/index.css';
import '../index.css';

const WIDGET_MIMETYPE = 'application/vnd.jupyter.widget';

export
const IIPyWidgetExtension = new Token<IIPyWidgetExtension>('jupyter.extensions.widgetManager');

export
interface IIPyWidgetExtension extends IPyWidgetExtension {};

export
class IPyWidgetExtension implements IWidgetExtension<NotebookPanel, INotebookModel> {
  /**
   * Create a new extension object.
   */
  createNew(nb: NotebookPanel, context: IDocumentContext<INotebookModel>): IDisposable {
    let wManager = new WidgetManager(context, nb.content.rendermime);
    this._registry.forEach(data => wManager.register(data));
    let wRenderer = new WidgetRenderer(wManager);

    nb.content.rendermime.addRenderer(WIDGET_MIMETYPE, wRenderer, 0);
    return new DisposableDelegate(() => {
      if (nb.rendermime) {
        nb.rendermime.removeRenderer(WIDGET_MIMETYPE);
      }
      wRenderer.dispose();
      wManager.dispose();
    });
  }

  /**
   * Register a widget module.
   */
  registerWidget(data: WidgetManager.IWidgetData) {
    this._registry.push(data);
  }
  private _registry: WidgetManager.IWidgetData[] = [];
}

export
class ServiceManagerOptions implements ServiceManager.IOptions {
  baseUrl?: string;
  ajaxSettings?: IAjaxSettings;
  kernelspecs?: Kernel.ISpecModels;
}

function main(): void {
  let jl = new JupyterLabEmbeddable('jupyter-notebook-wrapper', 'test.ipynb', undefined, undefined, 'http://localhost:8888');
  jl.embedJupyterLabUI();
}

export
class JupyterLabEmbeddable {
  public NOTEBOOK = 'test.ipynb';
  public div_id = 'jupyter-notebook-wrapper';
  public serviceManagerOptions: ServiceManagerOptions = {};
  public kernelModel: Kernel.IModel;

  constructor(div_id: string, notebook_name: string, kernelId?:string, ajaxSettings?: IAjaxSettings, baseUrl?: string) {
    this.div_id = div_id;
    this.NOTEBOOK = notebook_name;
    this.serviceManagerOptions.ajaxSettings = ajaxSettings; 
    this.serviceManagerOptions.baseUrl = baseUrl;

    if (kernelId != null) {
      this.kernelModel = { "id": kernelId }
    } else {
      this.kernelModel = null;
    }
  }

  /**
   * The widget manager provider.
   */
  private widgetManagerProvider: JupyterLabPlugin<IIPyWidgetExtension> = {
    id: 'jupyter.extensions.widgetManager',
    provides: IIPyWidgetExtension,
    requires: [IDocumentRegistry],
    activate: this.activateWidgetExtension,
    autoStart: true
  };

  /**
   * The map of command ids used by the notebook.
   */
  private cmdIds = {
    save: 'notebook:save',
    interrupt: 'notebook:interrupt-kernel',
    restart: 'notebook:restart-kernel',
    switchKernel: 'notebook:switch-kernel',
    runAndAdvance: 'notebook-cells:run-and-advance',
    deleteCell: 'notebook-cells:delete',
    selectAbove: 'notebook-cells:select-above',
    selectBelow: 'notebook-cells:select-below',
    extendAbove: 'notebook-cells:extend-above',
    extendBelow: 'notebook-cells:extend-below',
    editMode: 'notebook:edit-mode',
    merge: 'notebook-cells:merge',
    split: 'notebook-cells:split',
    commandMode: 'notebook:command-mode',
    undo: 'notebook-cells:undo',
    redo: 'notebook-cells:redo'
  };

  public embedJupyterLabUI(): void {
    ServiceManager.create(this.serviceManagerOptions).then(manager => {
      this.createApp(manager);
    });
  }

  /**
   * Activate the widget extension.
   */
  private activateWidgetExtension(app: JupyterLab, registry: IDocumentRegistry) {
    let extension = new IPyWidgetExtension();
    registry.addWidgetExtension('Notebook', extension);
    return extension;
  }

  private createApp(manager: IServiceManager): void {
    // Initialize the keymap manager with the bindings.
    let commands = new CommandRegistry();
    let keymap = new Keymap({ commands });
    let useCapture = true;

    // Setup the keydown listener for the document.
    document.addEventListener('keydown', event => {
      keymap.processKeydownEvent(event);
    }, useCapture);

    const transformers = [
      new JavascriptRenderer(),
      new MarkdownRenderer(),
      new HTMLRenderer(),
      new ImageRenderer(),
      new SVGRenderer(),
      new LatexRenderer(),
      new TextRenderer()
    ];
    let renderers: RenderMime.MimeMap<RenderMime.IRenderer> = {};
    let order: string[] = [];
    for (let t of transformers) {
      for (let m of t.mimetypes) {
        renderers[m] = t;
        order.push(m);
      }
    }
    let sanitizer = defaultSanitizer;
    let rendermime = new RenderMime({ renderers, order, sanitizer });

    let opener = {
      open: (widget: Widget) => {
        // Do nothing for sibling widgets for now.
      }
    };

    let docRegistry = new DocumentRegistry();
    let docManager = new DocumentManager({
      registry: docRegistry,
      manager,
      opener
    });
    let mFactory = new NotebookModelFactory();
    let clipboard = new MimeData();
    let renderer = CodeMirrorNotebookPanelRenderer.defaultRenderer;
    let wFactory = new NotebookWidgetFactory(rendermime, clipboard, renderer);
    docRegistry.addModelFactory(mFactory);
    docRegistry.addWidgetFactory(wFactory, {
      displayName: 'Notebook',
      modelName: 'notebook',
      fileExtensions: ['.ipynb'],
      defaultFor: ['.ipynb'],
      preferKernel: true,
      canStartKernel: true
    });

    this.activateWidgetExtension(null, docRegistry);

    let nbWidget = docManager.open(this.NOTEBOOK, undefined, this.kernelModel) as NotebookPanel;
    let palette = new CommandPalette({ commands, keymap });

    let panel = new SplitPanel();
    panel.id = 'main';
    panel.orientation = 'horizontal';
    panel.spacing = 0;
    SplitPanel.setStretch(palette, 0);
    panel.addWidget(palette);
    panel.addWidget(nbWidget);
    Widget.attach(panel, document.getElementById(this.div_id));

    SplitPanel.setStretch(nbWidget, 1);
    window.onresize = () => panel.update();

    commands.addCommand(this.cmdIds.save, {
      label: 'Save',
      execute: () => nbWidget.context.save()
    });
    commands.addCommand(this.cmdIds.interrupt, {
      label: 'Interrupt',
      execute: () => {
        if (nbWidget.context.kernel) {
          nbWidget.context.kernel.interrupt();
        }
      }
    });
    commands.addCommand(this.cmdIds.restart, {
      label: 'Restart Kernel',
      execute: () => restartKernel(nbWidget.kernel, nbWidget.node)
    });
    commands.addCommand(this.cmdIds.switchKernel, {
      label: 'Switch Kernel',
      execute: () => selectKernelForContext(nbWidget.context, nbWidget.node)
    });
    commands.addCommand(this.cmdIds.runAndAdvance, {
      label: 'Run and Advance',
      execute: () => {
        NotebookActions.runAndAdvance(nbWidget.content, nbWidget.context.kernel);
      }
    });
    commands.addCommand(this.cmdIds.editMode, {
      label: 'Edit Mode',
      execute: () => { nbWidget.content.mode = 'edit'; }
    });
    commands.addCommand(this.cmdIds.commandMode, {
      label: 'Command Mode',
      execute: () => { nbWidget.content.mode = 'command'; }
    });
    commands.addCommand(this.cmdIds.selectBelow, {
      label: 'Select Below',
      execute: () => NotebookActions.selectBelow(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.selectAbove, {
      label: 'Select Above',
      execute: () => NotebookActions.selectAbove(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.extendAbove, {
      label: 'Extend Above',
      execute: () => NotebookActions.extendSelectionAbove(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.extendBelow, {
      label: 'Extend Below',
      execute: () => NotebookActions.extendSelectionBelow(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.merge, {
      label: 'Merge Cells',
      execute: () => NotebookActions.mergeCells(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.split, {
      label: 'Split Cell',
      execute: () => NotebookActions.splitCell(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.undo, {
      label: 'Undo',
      execute: () => NotebookActions.undo(nbWidget.content)
    });
    commands.addCommand(this.cmdIds.redo, {
      label: 'Redo',
      execute: () => NotebookActions.redo(nbWidget.content)
    });

    let category = 'Notebook Operations';
    [
      this.cmdIds.interrupt,
      this.cmdIds.restart,
      this.cmdIds.editMode,
      this.cmdIds.commandMode,
      this.cmdIds.switchKernel
    ].forEach(command => palette.addItem({ command, category }));

    category = 'Notebook Cell Operations';
    [
      this.cmdIds.runAndAdvance,
      this.cmdIds.split,
      this.cmdIds.merge,
      this.cmdIds.selectAbove,
      this.cmdIds.selectBelow,
      this.cmdIds.extendAbove,
      this.cmdIds.extendBelow,
      this.cmdIds.undo,
      this.cmdIds.redo
    ].forEach(command => palette.addItem({ command, category }));

    let bindings = [
    {
      selector: '.jp-Notebook',
      keys: ['Shift Enter'],
      command: this.cmdIds.runAndAdvance
    },
    {
      selector: '.jp-Notebook',
      keys: ['Accel S'],
      command: this.cmdIds.save
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['I', 'I'],
      command: this.cmdIds.interrupt
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['0', '0'],
      command: this.cmdIds.restart
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Enter'],
      command: this.cmdIds.editMode
    },
    {
      selector: '.jp-Notebook.jp-mod-editMode',
      keys: ['Escape'],
      command: this.cmdIds.commandMode
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Shift M'],
      command: this.cmdIds.merge
    },
    {
      selector: '.jp-Notebook.jp-mod-editMode',
      keys: ['Ctrl Shift -'],
      command: this.cmdIds.split
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['J'],
      command: this.cmdIds.selectBelow
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['ArrowDown'],
      command: this.cmdIds.selectBelow
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['K'],
      command: this.cmdIds.selectAbove
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['ArrowUp'],
      command: this.cmdIds.selectAbove
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Shift K'],
      command: this.cmdIds.extendAbove
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Shift J'],
      command: this.cmdIds.extendBelow
    },
    {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Z'],
      command: this.cmdIds.undo
    },
      {
      selector: '.jp-Notebook.jp-mod-commandMode',
      keys: ['Y'],
      command: this.cmdIds.redo
    }
    ];
    bindings.map(binding => keymap.addBinding(binding));
  }
}

//window.onload = main;
