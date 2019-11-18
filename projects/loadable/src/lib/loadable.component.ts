import {
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Inject,
  Injector,
  Input,
  NgModuleRef,
  OnChanges,
  Optional,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ViewContainerRef
} from '@angular/core';
import { ILoadableRootOptions } from './loadable.config';
import { LoadableService, LOADABLE_ROOT_OPTIONS } from './loadable.service';

@Component({
  selector: 'ngx-loadable',
  template: `
    <ng-template #content></ng-template>
    <ng-template #placeholder></ng-template>
  `,
  styles: []
})
export class LoadableComponent implements OnChanges {
  //
  @Input() module: string;

  //
  @Input() show = false;

  //
  @Input() timeout: number | undefined;

  //
  @Input() isElement: boolean;

  //
  @Output() init = new EventEmitter();

  //
  @ViewChild('content', { read: ViewContainerRef, static: true })
  content: ViewContainerRef;

  //
  @ViewChild('placeholder', { read: ViewContainerRef, static: true })
  placeholder: ViewContainerRef;

  //
  @ContentChild('loading', { read: TemplateRef, static: false })
  loadingTemplate: TemplateRef<any>;

  //
  @ContentChild('error', { read: TemplateRef, static: false })
  errorTemplate: TemplateRef<any>;

  //
  @ContentChild('timedOut', { read: TemplateRef, static: false })
  timeoutTemplate: TemplateRef<any>;

  //
  private moduleRef: NgModuleRef<any>;

  //
  loading = false;

  //
  loaded = false;

  //
  error = false;

  //
  timedOut: boolean;

  //
  timeoutRef: any;

  //
  constructor(
    @Optional()
    @Inject(LOADABLE_ROOT_OPTIONS)
    private options: ILoadableRootOptions,
    private loadable: LoadableService,
    private elementRef: ElementRef,
    private injector: Injector
  ) {}

  //
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.show && changes.show.currentValue) {
      if (this.loaded) {
        this._render();
        return;
      }

      this.loadFn();
    }
  }

  //
  public async preload(): Promise<any> {
    if (!this.module) {
      return;
    }

    try {
      const moduleFactory = await this.loadable.preload(this.module);

      this.loaded = true;
      this.timedOut = false;
      this.moduleRef = moduleFactory.create(this.injector);

      return moduleFactory;
    } catch (error) {
      this.error = error;

      this.loadable._renderVCR(
        this.errorTemplate ||
          this.loadable.getModule(this.module).errorComponent ||
          this.options.errorComponent,
        this.content
      );

      return error;
    }
  }

  //
  private _render(): void {
    const module = this.loadable.getModule(this.module);

    if (this.isElement || module.isElement || this.options.isElement) {
      const componentInstance = document.createElement(module.name);

      this.init.next({
        instance: componentInstance
      });

      this.elementRef.nativeElement.appendChild(componentInstance);
      this.loading = false;
      return;
    }

    const componentRef = this.loadable._renderVCR(
      this.moduleRef,
      this.content,
      this.placeholder
    );
    this.init.next(componentRef);
    this.loading = false;
  }

  //
  reload(): void {
    this.timedOut = false;
    this.error = undefined;
    this.loadFn();
  }

  //
  _renderTimeoutTemplate(): void {
    this.timedOut = true;

    this.loadable._renderVCR(
      this.timeoutTemplate ||
        this.loadable.getModule(this.module).timeoutTemplate ||
        this.options.timeoutTemplate,
      this.content
    );
  }

  //
  loadFn(): void {
    if (typeof this.timeout === 'string') {
      this.timeout = parseInt(this.timeout, 10);
    }

    this.loading = true;

    this.loadable._renderVCR(
      this.loadingTemplate ||
        this.loadable.getModule(this.module).loadingComponent ||
        this.options.loadingComponent,
      this.placeholder
    );

    if (this.timeout === 0) {
      this._renderTimeoutTemplate();
    } else if (this.timeout > 0) {
      this.timeoutRef = setTimeout(() => {
        this._renderTimeoutTemplate();
      }, this.timeout);
    }

    this.preload().then(mf => {
      if (this.timeoutRef) {
        clearTimeout(this.timeoutRef);
      }

      if (mf instanceof Error) {
        return;
      }

      this.loading = false;
      this._render();
    });
  }
}
