import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';

export interface SortColumn {
  key: string;
  label: string;
  sortable?: boolean;
  customTemplate?: TemplateRef<any> | null;
}

export interface SortState {
  active?: string;
  direction?: 'asc' | 'desc' | null;
}

@Component({
  selector: 'app-sortable-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sortable-table.component.html',
  styleUrls: ['./sortable-table.component.css']
})
export class SortableTableComponent {
  @Input() columns: SortColumn[] = [];
  @Input() data: any[] = [];
  @Input() totalItems = 0;
  @Input() page = 0;
  @Input() pageSize = 20;
  @Input() currentSort: SortState = { active: undefined, direction: null };

  @Output() sortChange = new EventEmitter<SortState>();
  @Output() pageChange = new EventEmitter<number>();

  // trackBy helper
  trackByIndex(_: number, __: any): number {
    return _;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  toggleSort(column: SortColumn): void {
    if (!column.sortable) {
      return;
    }

    const isActive = this.currentSort?.active === column.key;
    let next: SortState = { active: column.key, direction: 'asc' };

    if (!isActive) {
      next = { active: column.key, direction: 'asc' };
    } else if (this.currentSort.direction === 'asc') {
      next = { active: column.key, direction: 'desc' };
    } else if (this.currentSort.direction === 'desc') {
      next = { active: undefined, direction: null };
    } else {
      next = { active: column.key, direction: 'asc' };
    }

    this.sortChange.emit(next);
  }

  sortIndicator(column: SortColumn): string {
    if (!column.sortable) {
      return '';
    }
    if (this.currentSort?.active === column.key) {
      return this.currentSort.direction === 'asc' ? '▲' : this.currentSort.direction === 'desc' ? '▼' : '';
    }
    return '';
  }

  prevPage(): void {
    if (this.page > 0) {
      this.pageChange.emit(this.page - 1);
    }
  }

  nextPage(totalPages: number): void {
    if (this.page + 1 < totalPages) {
      this.pageChange.emit(this.page + 1);
    }
  }
}
