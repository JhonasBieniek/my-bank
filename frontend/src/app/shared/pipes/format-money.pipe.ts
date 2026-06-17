import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatMoney',
  standalone: true,
})
export class FormatMoneyPipe implements PipeTransform {
  transform(cents: number | null | undefined): string {
    if (cents == null) {
      return 'R$ 0,00';
    }

    const reais = cents / 100;
    return reais.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }
}
