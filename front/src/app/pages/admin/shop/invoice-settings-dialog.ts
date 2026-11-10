import { ChangeDetectionStrategy, Component, effect, inject, model, output, signal } from '@angular/core';
import { attempt } from '../../../core/api/attempt';
import { Api } from '../../../core/api/generated/api';
import { getInvoiceSettings } from '../../../core/api/generated/fn/admin-invoices/get-invoice-settings';
import { updateInvoiceSettings } from '../../../core/api/generated/fn/admin-invoices/update-invoice-settings';
import { Toaster } from '../../../core/notifications/toaster';
import { Button } from '../../../shared/ui/button/button';
import { Dialog } from '../../../shared/ui/dialog/dialog';
import { Icon } from '../../../shared/ui/icon/icon';

/** What the invoices say of the seller. Copied onto each invoice when issued: a change is for the next ones. */
@Component({
  selector: 'yona-invoice-settings-dialog',
  imports: [Button, Dialog, Icon],
  template: `
    <yona-dialog title="Informations de facturation" [(open)]="open">
      <form id="invoice-settings-form" class="settings" (submit)="save($event)">
        <p class="field__hint">Elles s'écrivent sur chaque facture au moment où elle est générée : un changement vaut pour les suivantes</p>
        <div class="field">
          <label class="field__label" for="seller-name">Nom</label>
          <input id="seller-name" class="input" maxlength="150" placeholder="Prénom Nom, Les créations de Yona" [value]="name()" (input)="name.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="seller-address">Adresse</label>
          <textarea id="seller-address" class="input" rows="3" maxlength="500" [value]="address()" (input)="address.set($any($event.target).value)"></textarea>
        </div>
        <div class="field">
          <label class="field__label" for="seller-siret">SIRET (facultatif)</label>
          <input id="seller-siret" class="input" inputmode="numeric" maxlength="17" placeholder="14 chiffres, une fois immatriculée" [value]="siret()" (input)="siret.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="seller-contact">Contact (facultatif)</label>
          <input id="seller-contact" class="input" maxlength="200" placeholder="E-mail ou téléphone" [value]="contact()" (input)="contact.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label class="field__label" for="seller-vat">Mention de TVA</label>
          <input id="seller-vat" class="input" maxlength="200" [value]="vat()" (input)="vat.set($any($event.target).value)" />
          <span class="field__hint">En franchise de TVA (micro-entreprise) : « TVA non applicable, art. 293 B du CGI »</span>
        </div>
      </form>
      <ng-container dialogActions>
        <button yonaButton variant="ghost" type="button" (click)="open.set(false)">Annuler</button>
        <button yonaButton type="submit" form="invoice-settings-form" [disabled]="saving()"><svg yonaIcon="save"></svg>Enregistrer</button>
      </ng-container>
    </yona-dialog>
  `,
  styles: `
    .settings {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceSettingsDialog {
  readonly open = model(false);
  readonly saved = output<void>();

  private readonly api = inject(Api);
  private readonly toaster = inject(Toaster);

  protected readonly name = signal('');
  protected readonly address = signal('');
  protected readonly siret = signal('');
  protected readonly contact = signal('');
  protected readonly vat = signal('');
  protected readonly saving = signal(false);

  constructor() {
    // Read again at each opening: another admin may have changed them
    effect(() => {
      if (this.open()) {
        void this.load();
      }
    });
  }

  private async load(): Promise<void> {
    const settings = await attempt(this.api.invoke(getInvoiceSettings));
    if (settings.ok) {
      this.name.set(settings.value.sellerName ?? '');
      this.address.set(settings.value.sellerAddress ?? '');
      this.siret.set(settings.value.sellerSiret ?? '');
      this.contact.set(settings.value.sellerContact ?? '');
      this.vat.set(settings.value.vatMention);
    }
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.name().trim() || !this.address().trim()) {
      this.toaster.error('Indiquez le nom et l\'adresse à écrire sur les factures');
      return;
    }
    if (!this.vat().trim()) {
      this.toaster.error('Indiquez la mention de TVA');
      return;
    }
    this.saving.set(true);
    const saved = await attempt(
      this.api.invoke(updateInvoiceSettings, {
        body: {
          sellerName: this.name().trim(),
          sellerAddress: this.address().trim(),
          sellerSiret: this.siret().trim() || undefined,
          sellerContact: this.contact().trim() || undefined,
          vatMention: this.vat().trim(),
        },
      }),
    );
    this.saving.set(false);
    if (saved.ok) {
      this.toaster.success('Informations de facturation enregistrées');
      this.open.set(false);
      this.saved.emit();
    }
  }
}
