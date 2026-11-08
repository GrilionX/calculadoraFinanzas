//Pruebas
let fallos = 0;

function comprobar(nombre, obtenido, esperado) {
    const iguales = typeof esperado === "number"
        ? Number.isFinite(obtenido) && Math.abs(obtenido - esperado) < 0.005
        : obtenido === esperado;

    if (!iguales) {
        fallos++;
        console.error("✘ " + nombre, { obtenido, esperado });
    }
}

function ejecutarPruebas() {
    fallos = 0;
    const respaldoCategorias = categorias;
    const respaldoExtras = otrosIngresos;

    try {
        categorias = copiarCategoriasIniciales();
        otrosIngresos = [];

        //Sueldo y reparto
        const eq = calcularEquivalentes("mensual", 9377);
        comprobar("Semanal", eq.semanal, 2163.92);
        comprobar("Catorcenal", eq.cada2semanas, 4327.85);
        comprobar("Quincenal", eq.quincenal, 4688.50);
        comprobar("Anual", eq.anual, 112524);

        comprobar(
            "Quincena a mes",
            calcularEquivalentes("quincenal", 4688.5).mensual,
            9377
        );

        comprobar(
            "Semana a mes",
            calcularEquivalentes("semanal", 1000).mensual,
            4333.33
        );

        comprobar(
            "Sueldo cero",
            calcularEquivalentes("mensual", 0).anual,
            0
        );

        comprobar("Número infinito", leerNumero(Infinity), 0);

        const reparto = calcularReparto(eq);
        comprobar("Básicos", reparto[0].sueldo.semanal, 1190.16);
        comprobar("Deudas", reparto[2].sueldo.semanal, 540.98);
        comprobar("Ahorro", reparto[3].sueldo.mensual, 1406.55);

        comprobar(
            "Total repartido",
            reparto.reduce((s, f) => s + f.sueldo.semanal, 0),
            eq.semanal
        );

        //Otros ingresos
        const propinas = {
            nombre: "Prueba",
            monto: 150,
            modo: "promedio",
            frecuencia: "diaria",
            diasPorSemana: 6,
            semana: 1,
            repetir: 0,
            sumar: true,
            destinos: ["ocio", "ahorro"]
        };

        comprobar("Propinas semanales", calcularExtra(propinas).semanal, 900);
        comprobar("Propinas mensuales", calcularExtra(propinas).mensual, 3900);

        otrosIngresos = [propinas];
        comprobar("Extras repartidos", calcularReparto(eq)[1].extras.semanal, 450);

        propinas.sumar = false;
        comprobar("Extra desactivado", calcularReparto(eq)[1].extras.semanal, 0);

        propinas.sumar = true;
        propinas.destinos = ["inexistente"];
        comprobar("Sin destino", extrasSinDestino().length, 1);

        const bono = {
            nombre: "Bono",
            monto: 10000,
            modo: "golpe",
            frecuencia: "anual",
            diasPorSemana: 5,
            semana: 8,
            repetir: 52,
            sumar: true,
            destinos: ["ahorro"]
        };

        comprobar("Antes del bono", montoDeGolpe(bono, 7), 0);
        comprobar("Semana del bono", montoDeGolpe(bono, 8), 10000);
        comprobar("Repetición", montoDeGolpe(bono, 60), 10000);

        comprobar(
            "Una sola vez",
            montoDeGolpe({ ...bono, repetir: 0 }, 60),
            0
        );

        otrosIngresos = [bono];
        const calendario = calcularCalendario(eq, 26);
        comprobar("Semanas", calendario.semanas.length, 26);
        comprobar("Bono completo", calendario.semanas[7].deGolpe, 10000);
        comprobar("Bono al ahorro", calendario.porCategoria[3].deGolpe, 10000);
        comprobar("No promediar bono", calcularReparto(eq)[3].extras.semanal, 0);

        //Ahorro
        comprobar(
            "Saldo de ahorro",
            calcularSaldoAhorro([
                { tipo: "aportacion", montoCentavos: 15000 },
                { tipo: "aportacion", montoCentavos: 5025 },
                { tipo: "retiro", montoCentavos: 3010 }
            ]),
            17015
        );

        comprobar("Ahorro vacío", calcularSaldoAhorro([]), 0);

        comprobar(
            "Retiro sin fondos",
            limpiarMovimientosAhorro([
                { tipo: "retiro", concepto: "Prueba", montoCentavos: 1 }
            ]),
            null
        );

        comprobar("Importe exacto", convertirPesosACentavos("50.25"), 5025);
        comprobar("Decimales de más", convertirPesosACentavos("50.257"), null);

        //Deudas
        const deuda = {
            id: "prueba-a",
            nombre: "A",
            objetivoCentavos: 100000,
            prioridad: 1,
            aportaciones: [30000, 20000],
            liquidada: false
        };

        comprobar("Faltante", resumirDeuda(deuda).faltaCentavos, 50000);
        comprobar(
            "Disponible",
            resumirDeuda(deuda).apartadoDisponibleCentavos,
            50000
        );

        comprobar(
            "Identificadores duplicados",
            limpiarDeudas([deuda, deuda]),
            null
        );

        comprobar(
            "Liquidación incompleta",
            limpiarDeudas([{ ...deuda, liquidada: true }]),
            null
        );

        comprobar(
            "Apartado excesivo",
            limpiarDeudas([{ ...deuda, aportaciones: [100001] }]),
            null
        );

        comprobar(
            "Dinero pagado",
            resumirDeuda({
                ...deuda,
                aportaciones: [100000],
                liquidada: true
            }).apartadoDisponibleCentavos,
            0
        );

        const plan = [
            {
                ...deuda,
                objetivoCentavos: 50000,
                aportaciones: [20000]
            },
            {
                ...deuda,
                id: "prueba-b",
                nombre: "B",
                objetivoCentavos: 80000,
                prioridad: 2,
                aportaciones: []
            }
        ];

        const original = JSON.stringify(plan);
        const proyeccion = proyectarApartados(plan, 40000);

        comprobar("Primera semana", proyeccion.filas[0].semanaObjetivo, 1);
        comprobar("Tercera semana", proyeccion.filas[1].semanaObjetivo, 3);

        comprobar(
            "Presupuesto cero",
            proyectarApartados(plan, 0).filas[0].semanaObjetivo,
            null
        );

        comprobar("Sin modificar el plan", JSON.stringify(plan), original);

        //Nominas
        const plantilla = copiarCategoriasIniciales();
        const pagos = repartirNomina(10001, plantilla);

        comprobar(
            "Centavos conservados",
            pagos.reduce((s, f) => s + f.montoCentavos, 0),
            10001
        );

        plantilla[0].porcentaje = 50;
        plantilla[3].porcentaje = 20;

        comprobar("Historial independiente", pagos[0].porcentaje, 55);

        comprobar(
            "Nuevo reparto",
            repartirNomina(250000, plantilla)[3].montoCentavos,
            50000
        );

        comprobar("Copia antigua", limpiarNominas(undefined).length, 0);

        const nomina = {
            version: 1,
            id: "nomina-prueba",
            referencia: "Prueba",
            periodo: "semanal",
            montoCentavos: 10001,
            reparto: pagos
        };

        comprobar("Nómina válida", limpiarNominas([nomina]).length, 1);

        const alterada = copiar(nomina);
        alterada.reparto[0].montoCentavos++;
        comprobar("Nómina alterada", limpiarNominas([alterada]), null);

        //Disponible por nomina
        const nominaDisponible = {
            id: "nomina-disponible",
            reparto: [
                {
                    id: "deudas",
                    nombre: "Deudas",
                    porcentaje: 25,
                    montoCentavos: 50000
                },
                {
                    id: "ahorro",
                    nombre: "Ahorro",
                    porcentaje: 15,
                    montoCentavos: 30000
                }
            ]
        };

        const movimientosDisponibles = [
            {
                id: "movimiento-1",
                nominaId: "nomina-disponible",
                categoriaId: "deudas",
                montoCentavos: 30000
            },
            {
                id: "movimiento-2",
                nominaId: "nomina-disponible",
                categoriaId: "deudas",
                montoCentavos: 15000
            },
            {
                id: "movimiento-3",
                nominaId: "otra-nomina",
                categoriaId: "deudas",
                montoCentavos: 90000
            },
            {
                id: "movimiento-4",
                nominaId: "nomina-disponible",
                categoriaId: "ahorro",
                montoCentavos: 10000
            }
        ];

        const disponibleDeudas = calcularDisponibleCategoria(
            nominaDisponible,
            "deudas",
            movimientosDisponibles
        );

        comprobar(
            "Asignación original",
            disponibleDeudas.asignadoCentavos,
            50000
        );

        comprobar(
            "Solo cuenta la nómina y categoría elegidas",
            disponibleDeudas.utilizadoCentavos,
            45000
        );

        comprobar(
            "Disponible para nuevos apartados",
            disponibleDeudas.disponibleCentavos,
            5000
        );

        const disponibleAhorro = calcularDisponibleCategoria(
            nominaDisponible,
            "ahorro",
            movimientosDisponibles
        );

        comprobar(
            "Ahorro separado de deudas",
            disponibleAhorro.disponibleCentavos,
            20000
        );

        const sinMovimientos = calcularDisponibleCategoria(
            nominaDisponible,
            "deudas",
            []
        );

        comprobar(
            "Sin movimientos conserva toda la asignación",
            sinMovimientos.disponibleCentavos,
            50000
        );

        let excesoRechazado = false;

        try {
            calcularDisponibleCategoria(
                nominaDisponible,
                "deudas",
                [
                    ...movimientosDisponibles,
                    {
                        id: "movimiento-excesivo",
                        nominaId: "nomina-disponible",
                        categoriaId: "deudas",
                        montoCentavos: 5001
                    }
                ]
            );
        } catch {
            excesoRechazado = true;
        }

        comprobar(
            "Rechaza utilizar más dinero del asignado",
            excesoRechazado,
            true
        );

        let duplicadoRechazado = false;

        try {
            calcularDisponibleCategoria(
                nominaDisponible,
                "deudas",
                [
                    movimientosDisponibles[0],
                    movimientosDisponibles[0]
                ]
            );
        } catch {
            duplicadoRechazado = true;
        }

        comprobar(
            "Rechaza movimientos duplicados",
            duplicadoRechazado,
            true
        );

        let categoriaAusenteRechazada = false;

        try {
            calcularDisponibleCategoria(
                nominaDisponible,
                "categoria-inexistente",
                []
            );
        } catch {
            categoriaAusenteRechazada = true;
        }

        comprobar(
            "No inventa saldo para categorías ausentes",
            categoriaAusenteRechazada,
            true
        );

        //Copias
        comprobar(
            "Formato válido",
            esCopiaValida({
                app: "finanzas-personal",
                version: 1,
                datos: {}
            }),
            true
        );

        comprobar(
            "Versión desconocida",
            esCopiaValida({
                app: "finanzas-personal",
                version: 99,
                datos: {}
            }),
            false
        );

        comprobar("Copia vacía", aplicarDatos({}), false);

        const estadoAnterior = JSON.stringify(construirPaquete());
        const invalida = copiar(construirPaquete());
        invalida.categorias = null;

        comprobar("Categorías inválidas", aplicarDatos(invalida), false);

        comprobar(
            "Rechazo sin cambios",
            JSON.stringify(construirPaquete()),
            estadoAnterior
        );
    } catch (error) {
        fallos++;
        console.error("Error en las pruebas:", error);
    } finally {
        categorias = respaldoCategorias;
        otrosIngresos = respaldoExtras;
    }

    console.log(
        fallos === 0
            ? "Todas las pruebas pasaron."
            : "Fallaron " + fallos + " prueba(s)."
    );

    return fallos;
}

ejecutarPruebas();