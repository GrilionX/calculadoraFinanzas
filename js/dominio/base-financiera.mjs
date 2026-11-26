//Base de la próxima fase. No lee ni escribe los datos de la aplicación actual.
function exigir(condicion,mensaje){if(!condicion)throw new Error(mensaje);}
function texto(v){return typeof v==="string"&&v.trim().length>0&&v.length<=120;}
export function centavos(v,permiteCero=false){
 exigir(Number.isSafeInteger(v)&&(permiteCero?v>=0:v>0),"Importe inválido: usa centavos enteros.");return v;
}
function sumar(valores){const n=valores.reduce((a,b)=>a+BigInt(b),0n);exigir(n<=BigInt(Number.MAX_SAFE_INTEGER)&&n>=BigInt(Number.MIN_SAFE_INTEGER),"Importe fuera de rango.");return Number(n);}
export function fechaCivil(v){
 exigir(typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v.slice(0,4)>="1900","Fecha inválida.");
 const d=new Date(v+"T12:00:00Z");exigir(!Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v,"Fecha inválida.");return v;
}
function intervalo(desde,hasta){fechaCivil(desde);fechaCivil(hasta);exigir(desde<=hasta,"Periodo invertido.");}
export function repartirCentavos(total,pesos){
 centavos(total,true);exigir(Array.isArray(pesos)&&pesos.length>0,"Faltan destinos.");
 pesos.forEach(p=>centavos(p,true));const suma=pesos.reduce((a,b)=>a+BigInt(b),0n);exigir(suma>0n,"Los pesos no pueden sumar cero.");
 const partes=pesos.map((p,i)=>({i,importe:Number(BigInt(total)*BigInt(p)/suma),resto:BigInt(total)*BigInt(p)%suma}));
 let faltan=total-sumar(partes.map(p=>p.importe));
 const orden=[...partes].sort((a,b)=>a.resto===b.resto?a.i-b.i:a.resto>b.resto?-1:1);
 for(let i=0;i<faltan;i++)orden[i].importe++;
 return partes.map(p=>p.importe);
}
export function validarCuentas(cuentas){
 exigir(Array.isArray(cuentas),"Faltan cuentas.");const ids=new Set();
 for(const c of cuentas){
 exigir(c&&texto(c.id)&&texto(c.nombre)&&!ids.has(c.id),"Cuenta inválida o repetida.");ids.add(c.id);
 exigir(["efectivo","debito","credito"].includes(c.tipo),"Tipo de cuenta inválido.");
 centavos(c.saldoInicialCentavos,true);
 exigir(c.moneda==="MXN","Esta fase solo admite MXN.");
 if(c.tipo==="credito")exigir(c.limiteCentavos===null||(Number.isSafeInteger(c.limiteCentavos)&&c.limiteCentavos>=0),"Límite inválido.");
 }
 return cuentas;
}
function desglose(total,lineas,clave){
 exigir(Array.isArray(lineas)&&lineas.length>0,"Falta el desglose.");const ids=new Set();
 for(const l of lineas){exigir(l&&texto(l[clave])&&!ids.has(l[clave]),"Destino inválido o repetido.");ids.add(l[clave]);centavos(l.montoCentavos);}
 exigir(sumar(lineas.map(l=>l.montoCentavos))===total,"El desglose no coincide con el total.");
}
//Crédito positivo significa deuda; un cashback puede dejar saldo a favor (negativo).
export function prepararMovimiento(entrada,cuentas){
 validarCuentas(cuentas);const m=structuredClone(entrada);
 exigir(m&&texto(m.id)&&texto(m.concepto),"Identificador o concepto inválido.");fechaCivil(m.fecha);centavos(m.totalCentavos);
 exigir(["ingreso","gasto","transferencia","pago_tarjeta","cashback"].includes(m.tipo),"Movimiento no admitido.");
 exigir(["confirmado","pendiente"].includes(m.estado),"Confirma el estado.");
 const cuenta=id=>{const c=cuentas.find(c=>c.id===id);exigir(c,"Cuenta inexistente.");return c;};
 const efectos=[];
 if(m.tipo==="gasto"){
 desglose(m.totalCentavos,m.partidas,"categoriaId");desglose(m.totalCentavos,m.pagos,"cuentaId");
 for(const p of m.pagos){const c=cuenta(p.cuentaId);efectos.push({cuentaId:c.id,deltaCentavos:c.tipo==="credito"?p.montoCentavos:-p.montoCentavos});}
 }else if(m.tipo==="transferencia"||m.tipo==="pago_tarjeta"){
 const origen=cuenta(m.origenId),destino=cuenta(m.destinoId);
 exigir(origen.id!==destino.id&&origen.tipo!=="credito","Origen inválido.");
 exigir(m.tipo==="transferencia"?destino.tipo!=="credito":destino.tipo==="credito","Destino inválido.");
 efectos.push({cuentaId:origen.id,deltaCentavos:-m.totalCentavos},{cuentaId:destino.id,deltaCentavos:m.tipo==="pago_tarjeta"?-m.totalCentavos:m.totalCentavos});
 }else{
 const destino=cuenta(m.destinoId);exigir(m.tipo!=="ingreso"||destino.tipo!=="credito","Un ingreso requiere efectivo o débito.");
 if(m.tipo==="cashback")exigir(texto(m.referencia),"El cashback requiere una referencia única del abono.");
 efectos.push({cuentaId:destino.id,deltaCentavos:destino.tipo==="credito"?-m.totalCentavos:m.totalCentavos});
 }
 //Se derivan los efectos; nunca se aceptan importes calculados por el formulario.
 return {...m,efectos};
}
function movimientosValidos(cuentas,movimientos){
 exigir(Array.isArray(movimientos),"Movimientos inválidos.");const ids=new Set(),cashbacks=new Set();
 return movimientos.map(m=>{
 const x=prepararMovimiento(m,cuentas);exigir(!ids.has(x.id),"Movimiento repetido.");ids.add(x.id);
 if(x.tipo==="cashback"){const ref=x.destinoId+"\u0000"+x.referencia.trim();exigir(!cashbacks.has(ref),"Cashback repetido.");cashbacks.add(ref);}
 return x;
 });
}
export function calcularCuentas(cuentas,movimientos){
 validarCuentas(cuentas);const saldos=Object.fromEntries(cuentas.map(c=>[c.id,c.saldoInicialCentavos]));
 for(const m of movimientosValidos(cuentas,movimientos).filter(m=>m.estado==="confirmado").sort((a,b)=>a.fecha.localeCompare(b.fecha)))
 for(const e of m.efectos)saldos[e.cuentaId]=sumar([saldos[e.cuentaId],e.deltaCentavos]);
 return cuentas.map(c=>({id:c.id,tipo:c.tipo,saldoCentavos:saldos[c.id],
 disponibleCentavos:c.tipo==="credito"?(c.limiteCentavos===null?null:sumar([c.limiteCentavos,-saldos[c.id]])):saldos[c.id],
 saldoAFavorCentavos:c.tipo==="credito"?Math.max(0,-saldos[c.id]):0}));
}
export function comprobarNuevaOperacion(cuentas,movimientos,nueva){
 const m=prepararMovimiento(nueva,cuentas);
 const saldos=calcularCuentas(cuentas,[...movimientos,m]);
 if(m.estado==="confirmado"){
 for(const e of m.efectos){const c=cuentas.find(c=>c.id===e.cuentaId),s=saldos.find(s=>s.id===c.id);
 if(c.tipo!=="credito"&&e.deltaCentavos<0)exigir(s.saldoCentavos>=0,"Saldo insuficiente.");
 if(c.tipo==="credito"&&e.deltaCentavos>0&&c.limiteCentavos!==null)exigir(s.disponibleCentavos>=0,"Crédito insuficiente.");
 }
 }
 return m;
}
export function resumirPresupuestos(cuentas,movimientos,presupuestos,desde,hasta){
 intervalo(desde,hasta);exigir(Array.isArray(presupuestos),"Presupuestos inválidos.");const ids=new Set();
 for(const p of presupuestos){exigir(texto(p.categoriaId)&&!ids.has(p.categoriaId),"Categoría repetida.");ids.add(p.categoriaId);centavos(p.limiteCentavos,true);}
 const gastos=new Map();
 for(const m of movimientosValidos(cuentas,movimientos))if(m.estado==="confirmado"&&m.tipo==="gasto"&&m.fecha>=desde&&m.fecha<=hasta)
 for(const p of m.partidas)gastos.set(p.categoriaId,sumar([gastos.get(p.categoriaId)||0,p.montoCentavos]));
 return presupuestos.map(p=>({...p,gastadoCentavos:gastos.get(p.categoriaId)||0,restanteCentavos:sumar([p.limiteCentavos,-(gastos.get(p.categoriaId)||0)])}));
}
export function crearCalendario(eventos,desde,hasta){
 intervalo(desde,hasta);const ids=new Set();
 exigir(Array.isArray(eventos),"Calendario inválido.");
 for(const e of eventos){exigir(e&&texto(e.id)&&!ids.has(e.id)&&texto(e.concepto),"Vencimiento inválido.");ids.add(e.id);fechaCivil(e.fecha);centavos(e.montoCentavos,true);exigir(["pendiente","pagado"].includes(e.estado),"Estado inválido.");}
 return eventos.filter(e=>e.fecha>=desde&&e.fecha<=hasta).map(e=>({...e})).sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.id.localeCompare(b.id));
}
export function prepararCierre(cuentas,movimientos,presupuestos,desde,hasta){
 intervalo(desde,hasta);
 const lista=movimientosValidos(cuentas,movimientos).filter(m=>m.estado==="confirmado"&&m.fecha>=desde&&m.fecha<=hasta);
 const total=tipo=>sumar(lista.filter(m=>m.tipo===tipo).map(m=>m.totalCentavos));
 return {desde,hasta,ingresosCentavos:total("ingreso"),gastosCentavos:total("gasto"),cashbackCentavos:total("cashback"),
 pagosTarjetaCentavos:total("pago_tarjeta"),transferenciasCentavos:total("transferencia"),
 presupuestos:resumirPresupuestos(cuentas,movimientos,presupuestos,desde,hasta),requiereConfirmacion:true};
}
//La proyección recibe el saldo líquido actual y eventos futuros ya expandidos.
export function proyectarLiquidez(saldoActual,eventos,desde,hasta){
 centavos(saldoActual,true);intervalo(desde,hasta);exigir(Array.isArray(eventos),"Proyección inválida.");const ids=new Set();
 for(const e of eventos){exigir(e&&texto(e.id)&&!ids.has(e.id),"Evento repetido.");ids.add(e.id);fechaCivil(e.fecha);centavos(e.montoCentavos);exigir(["entrada","salida"].includes(e.tipo),"Tipo inválido.");}
 let saldo=saldoActual;const puntos=[];
 for(const e of eventos.filter(e=>e.fecha>=desde&&e.fecha<=hasta).sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.id.localeCompare(b.id))){
 saldo=sumar([saldo,e.tipo==="entrada"?e.montoCentavos:-e.montoCentavos]);puntos.push({...e,saldoCentavos:saldo});
 }
 return {estimacion:true,saldoFinalCentavos:saldo,minimoCentavos:puntos.reduce((n,p)=>Math.min(n,p.saldoCentavos),saldoActual),puntos};
}
