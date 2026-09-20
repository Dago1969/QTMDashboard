# Nota Rapida - Reapplicare ng-select2 in QTMDB

Questa nota serve per riapplicare una select ricercabile in modo consistente con le pagine QTMDB.

## 1) Installazione dipendenza

Eseguire da `frontend`:

```bash
npm install ng-select2-component
```

Se il progetto usa lockfile condiviso, verificare che `package-lock.json` venga aggiornato.

## 2) Import nel componente standalone

Nel componente Angular standalone:

- aggiungere `import { Select2 } from 'ng-select2-component';`
- aggiungere `Select2` in `imports: [...]`

## 3) Template consigliato

Usare `ng-select2` con ricerca attiva e reset:

```html
<ng-select2
  class="qtm-select2-field"
  [(ngModel)]="filters.regionCode"
  name="regionCode"
  [data]="regionSelect2Data"
  [placeholder]="t('crud.select.all')"
  [displaySearchStatus]="'always'"
  [resettable]="true"
  (update)="onRegionUpdate($event)"
></ng-select2>
```

Note importanti:

- usare `(update)` per avere comportamento affidabile con mouse e tastiera
- non usare solo `(ngModelChange)` sui filtri cascata
- evitare contenitori `label` attorno a `ng-select2` per prevenire interferenze sui click

## 4) Data binding stabile (evitare reset selezione)

Non creare l'array `data` inline nel template a ogni render.

Buona pratica:

- mantenere proprietà stabili: `regionSelect2Data`, `aslSelect2Data`, `hospitalSelect2Data`
- rigenerarle solo quando cambiano realmente le opzioni (es. `refreshSelect2Data()`)

## 5) Normalizzazione valori

Con `ng-select2` i valori vanno trattati come stringa:

- usare sempre `String(...)`
- normalizzare codici regione numerici con `padStart(2, '0')` (es. `9 -> 09`)
- nei confronti evitare mismatch numero/stringa

## 6) Filtri dipendenti (Regione -> ASL -> Ospedale)

Quando cambia Regione:

- ricalcolare le opzioni ASL disponibili
- azzerare ASL selezionata se non piu valida
- ricalcolare le opzioni Ospedale
- azzerare Ospedale selezionato se non piu valido
- aggiornare anche i dataset Select2 (`aslSelect2Data` e `hospitalSelect2Data`)

## 7) Caso reale QTMDB: codici ASL non univoci tra regioni

Nel backend, non usare solo `codiceAzienda` per trovare ASL.

Usare chiave composta:

- `codiceRegione + codiceAzienda` (es. `09|203`)

Questo evita associazioni errate tra regioni diverse con stesso codice ASL.

## 8) Verifica locale obbligatoria

Da `frontend`:

```bash
npm run build
```

## 9) Verifica deploy PROD

Se in produzione non compare la search box ma in locale si:

- il problema e quasi sempre artefatto vecchio/cached
- verificare che il path deploy punti al dist appena generato
- riavviare il servizio frontend e fare hard refresh browser

## 10) Checklist veloce

- dipendenza presente
- `Select2` importato nel componente
- `displaySearchStatus='always'`
- evento `(update)` configurato
- dataset `data` stabili (non inline)
- normalizzazione stringhe/codici (`09`)
- build frontend OK
- deploy su dist aggiornato
