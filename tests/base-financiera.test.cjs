const {test,before}=require('node:test');
const assert=require('node:assert/strict');
let base;
before(async()=>{base=await import('../js/dominio/base-financiera.mjs');});
const cuentas=()=>[
 {id:'efectivo',nombre:'Efectivo',tipo:'efectivo',moneda:'MXN',saldoInicialCentavos:10000},
 {id:'banco',nombre:'Débito',tipo:'debito',moneda:'MXN',saldoInicialCentavos:50000},
 {id:'tarjeta',nombre:'Crédito',tipo:'credito',moneda:'MXN',saldoInicialCentavos:0,limiteCentavos:30000}
];
const gasto=(extra={})=>({id:'g1',tipo:'gasto',concepto:'Compra',fecha:'2026-11-25',estado:'confirmado',totalCentavos:10000,
 partidas:[{categoriaId:'comida',montoCentavos:7000},{categoriaId:'ocio',montoCentavos:3000}],
 pagos:[{cuentaId:'efectivo',montoCentavos:4000},{cuentaId:'tarjeta',montoCentavos:6000}],...extra});
const cashback=(extra={})=>({id:'c1',tipo:'cashback',concepto:'Recompensa',referencia:'abono-1',fecha:'2026-11-25',estado:'confirmado',totalCentavos:1000,destinoId:'tarjeta',...extra});
test('base: centavos exactos y fechas civiles válidas',()=>{
 for(const n of [-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>base.centavos(n));
 assert.equal(base.fechaCivil('2028-02-29'),'2028-02-29');
 for(const f of ['2026-02-29','2026-04-31','2026-1-01','x'])assert.throws(()=>base.fechaCivil(f));
});
test('base: reparto por peso sin perder centavos',()=>{
 assert.deepEqual(base.repartirCentavos(100,[1,1,1]),[34,33,33]);
 assert.deepEqual(base.repartirCentavos(7,[0,2,1]),[0,5,2]);
 assert.equal(base.repartirCentavos(Number.MAX_SAFE_INTEGER,[1,2]).reduce((a,b)=>a+b,0),Number.MAX_SAFE_INTEGER);
 assert.throws(()=>base.repartirCentavos(1,[0,0]));
});
test('base: cuentas únicas y moneda explícita',()=>{
 assert.throws(()=>base.validarCuentas([...cuentas(),cuentas()[0]]));
 const c=cuentas();c[0].moneda='USD';assert.throws(()=>base.validarCuentas(c));
});
test('base: compra mixta afecta efectivo y crédito una sola vez',()=>{
 const c=cuentas(),g=gasto(),antes=JSON.stringify([c,g]);
 const s=base.calcularCuentas(c,[g]);
 assert.equal(s[0].saldoCentavos,6000);assert.equal(s[2].saldoCentavos,6000);
 assert.equal(s[2].disponibleCentavos,24000);assert.equal(JSON.stringify([c,g]),antes);
});
test('base: transferencia conserva patrimonio y no crea gasto',()=>{
 const m={id:'t1',tipo:'transferencia',concepto:'Cajero',fecha:'2026-11-25',estado:'confirmado',totalCentavos:5000,origenId:'banco',destinoId:'efectivo'};
 const s=base.calcularCuentas(cuentas(),[m]);assert.equal(s[0].saldoCentavos+s[1].saldoCentavos,60000);
 const r=base.prepararCierre(cuentas(),[m],[],'2026-11-01','2026-11-30');assert.equal(r.gastosCentavos,0);assert.equal(r.transferenciasCentavos,5000);
 assert.throws(()=>base.prepararMovimiento({...m,destinoId:'banco'},cuentas()));
});
test('base: pago de tarjeta disminuye deuda sin repetir compra',()=>{
 const m={id:'p1',tipo:'pago_tarjeta',concepto:'Pago',fecha:'2026-11-25',estado:'confirmado',totalCentavos:6000,origenId:'banco',destinoId:'tarjeta'};
 const s=base.calcularCuentas(cuentas(),[gasto(),m]);assert.equal(s[2].saldoCentavos,0);assert.equal(s[1].saldoCentavos,44000);
 const r=base.prepararCierre(cuentas(),[gasto(),m],[],'2026-11-01','2026-11-30');assert.equal(r.gastosCentavos,10000);assert.equal(r.pagosTarjetaCentavos,6000);
});
test('base: cashback pendiente no aumenta disponible',()=>{
 const s=base.calcularCuentas(cuentas(),[gasto(),cashback({estado:'pendiente'})]);assert.equal(s[2].saldoCentavos,6000);
});
test('base: cashback confirmado reduce deuda y admite saldo a favor',()=>{
 const s=base.calcularCuentas(cuentas(),[cashback()]);assert.equal(s[2].saldoAFavorCentavos,1000);assert.equal(s[2].disponibleCentavos,31000);
 const r=base.prepararCierre(cuentas(),[cashback()],[],'2026-11-01','2026-11-30');assert.equal(r.ingresosCentavos,0);assert.equal(r.cashbackCentavos,1000);
});
test('base: cashback a débito y duplicados',()=>{
 const s=base.calcularCuentas(cuentas(),[cashback({destinoId:'banco'})]);assert.equal(s[1].saldoCentavos,51000);
 assert.throws(()=>base.calcularCuentas(cuentas(),[cashback(),cashback({id:'otra'})]));
 assert.throws(()=>base.calcularCuentas(cuentas(),[gasto(),gasto()]));
});
test('base: desgloses deben sumar exactamente el total',()=>{
 assert.throws(()=>base.prepararMovimiento(gasto({pagos:[{cuentaId:'banco',montoCentavos:9999}]}),cuentas()));
 assert.throws(()=>base.prepararMovimiento(gasto({partidas:[{categoriaId:'comida',montoCentavos:10001}]}),cuentas()));
});
test('base: operación nueva respeta efectivo y límite',()=>{
 assert.throws(()=>base.comprobarNuevaOperacion(cuentas(),[],gasto({totalCentavos:40000,partidas:[{categoriaId:'comida',montoCentavos:40000}],pagos:[{cuentaId:'tarjeta',montoCentavos:40000}]})));
 const c=cuentas();c[0].saldoInicialCentavos=1;assert.throws(()=>base.comprobarNuevaOperacion(c,[],gasto()));
});
test('base: presupuestos por subcategoría y cierre solo de lectura',()=>{
 const p=[{categoriaId:'comida',limiteCentavos:8000},{categoriaId:'ocio',limiteCentavos:2000}];
 const r=base.prepararCierre(cuentas(),[gasto()],p,'2026-11-01','2026-11-30');
 assert.equal(r.presupuestos[0].restanteCentavos,1000);assert.equal(r.presupuestos[1].restanteCentavos,-1000);assert.equal(r.requiereConfirmacion,true);
 assert.equal(p[0].limiteCentavos,8000);
});
test('base: calendario ordenado sin ejecutar pagos',()=>{
 const e=[{id:'b',concepto:'Internet',fecha:'2026-11-28',montoCentavos:10000,estado:'pendiente'},{id:'a',concepto:'Gas',fecha:'2026-11-26',montoCentavos:5000,estado:'pagado'}];
 const r=base.crearCalendario(e,'2026-11-01','2026-11-30');assert.deepEqual(r.map(e=>e.id),['a','b']);assert.equal(e[0].id,'b');
});
test('base: proyección muestra déficit sin modificar saldo actual',()=>{
 const r=base.proyectarLiquidez(10000,[{id:'1',tipo:'salida',fecha:'2026-11-26',montoCentavos:15000},{id:'2',tipo:'entrada',fecha:'2026-11-27',montoCentavos:20000}],'2026-11-25','2026-11-30');
 assert.equal(r.estimacion,true);assert.equal(r.minimoCentavos,-5000);assert.equal(r.saldoFinalCentavos,15000);
 assert.throws(()=>base.proyectarLiquidez(1,[],'2026-11-30','2026-11-01'));
});
test('base: importe calculado no se acepta desde formulario',()=>{
 const s=base.calcularCuentas(cuentas(),[gasto({efectos:[{cuentaId:'banco',deltaCentavos:999999}]})]);
 assert.equal(s[1].saldoCentavos,50000);assert.equal(s[0].saldoCentavos,6000);
});
