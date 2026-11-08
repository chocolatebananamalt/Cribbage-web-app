const whole = new Intl.NumberFormat('en-US',{maximumFractionDigits:0});
/** Exact minor-unit formatting, including safe-integer boundary amounts. */
export function formatFinanceMoneyV1(minor:number):string {
 if(!Number.isSafeInteger(minor))return 'Not available';
 const value=BigInt(minor),zero=BigInt(0),hundred=BigInt(100),absolute=value<zero?-value:value;
 return `${value<zero?'-':''}$${whole.format(absolute/hundred)}.${String(absolute%hundred).padStart(2,'0')}`;
}
