-- HOCFLIT-W1 (RFC-HOCFLIT-Clases-De-Agentes §2 y D-H2): la taxonomía del Modelo HOCFLIT
-- como DATO en el plano de control. Prompts de agentes, ACLs (kdb_agent_acls), tarjetas del
-- panel y catálogo comercial se derivan de aquí; queda prohibido volver a duplicarla como
-- constante por repo.
--
-- Fuente de nombres y descripciones: «Modelo HOCFLIT para la Dirección y Administración de
-- Empresas» (López, 2026, Grupo Dúo Consulting). Descripciones CONDENSADAS — el texto íntegro
-- no se replica: es material del JV en negociación y entra como PCC licenciado (D-H7).
--
-- 40 filas = 35 bloques de los 7 sistemas + 5 de la Dirección Ejecutiva (E).
-- Idempotente: CREATE TABLE IF NOT EXISTS + ON CONFLICT DO NOTHING.
-- Depende de: nada (tabla nueva, sin FK). Aplicar DESPUÉS de 001..011.

BEGIN;

CREATE TABLE IF NOT EXISTS hocflit_blocks (
    code         TEXT PRIMARY KEY,
    group_code   TEXT NOT NULL,
    group_name   TEXT NOT NULL,
    placement    TEXT NOT NULL CHECK (placement IN ('techo', 'transversal', 'columna', 'piso')),
    level        INT  NOT NULL CHECK (level BETWEEN 1 AND 5),
    name         TEXT NOT NULL,
    description  TEXT,
    system_slug  TEXT CHECK (system_slug IN (
        'h-talento-humano', 'o-operaciones', 'c-comercial', 'f-finanzas',
        'l-legal', 'i-innovacion', 't-tecnologia'
    )),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_code, level)
);

COMMENT ON TABLE hocflit_blocks IS
    'Taxonomía canónica del Modelo HOCFLIT (López, 2026). Una fila por bloque de responsabilidad. Es la fuente única: no duplicar como constante en los repos (D-H2).';

COMMENT ON COLUMN hocflit_blocks.level IS
    'Nivel de SOFISTICACIÓN funcional 1..5 del modelo. NO es altitude (nivel de abstracción del conocimiento, distiller-v2). Son ejes DISTINTOS: confundirlos rompe HITL>=4, altitude_max de licencias, pisos por rol y el gate de kdb_search.';

COMMENT ON COLUMN hocflit_blocks.system_slug IS
    'Slug del sistema OKF al que mapea el bloque. NULL en la Dirección Ejecutiva (E): no es un 8.º slug, se modela sobre la superficie direccion (systems=all, altitude_min=4).';

COMMENT ON COLUMN hocflit_blocks.description IS
    'Descripción condensada del libro. NULL = pendiente de confirmar con el autor (hoy sólo I3, ilegible en la fuente). Detectable con WHERE description IS NULL.';

COMMENT ON COLUMN hocflit_blocks.placement IS
    'Geometría del modelo: techo (E), transversal (I), columna (H/O/C/F/L), piso (T). De aquí se derivan los roles de agente transversales frente a los de columna.';

INSERT INTO hocflit_blocks (code, group_code, group_name, placement, level, name, description, system_slug) VALUES
-- E — Dirección Ejecutiva (techo; + «Relación con los Socios» en la cúspide, que no es bloque)
('E1', 'E', 'Dirección Ejecutiva', 'techo', 1, 'Visión Empresarial',
 'Definir el propósito amplio de la empresa y la estrategia a largo plazo, alineando a toda la organización en una misma dirección estratégica.', NULL),
('E2', 'E', 'Dirección Ejecutiva', 'techo', 2, 'Representación Organizacional',
 'Gestionar las relaciones externas e internas y salvaguardar la legitimidad institucional de la empresa ante el mercado, los socios y la sociedad.', NULL),
('E3', 'E', 'Dirección Ejecutiva', 'techo', 3, 'Fomentar Talento Clave',
 'Identificar, preparar y apoyar a los líderes directivos y gerenciales que encabezan los sistemas estructurales, garantizando una delegación eficiente de facultades y funciones clave.', NULL),
('E4', 'E', 'Dirección Ejecutiva', 'techo', 4, 'Procuración de Activos',
 'Asegurar la obtención, optimización y mantenimiento de los activos tangibles e intangibles capitalizados por la empresa (marcas, patentes, metodologías), base de su sostenibilidad y del patrimonio de socios e inversores.', NULL),
('E5', 'E', 'Dirección Ejecutiva', 'techo', 5, 'Desarrollo de Valor',
 'Comprender los elementos que generan valor multidimensional —presente y futuro— en todos los sistemas empresariales para el ecosistema de consumidores, mitigando de forma proactiva los factores de riesgo que puedan destruirlo.', NULL),

-- I — Desarrollo de Innovaciones (banda transversal)
('I1', 'I', 'Desarrollo de Innovaciones', 'transversal', 1, 'Mejora Continua',
 'Establecer sistemas de optimización constante de los procesos existentes en todas las verticales estructurales, buscando eficiencias funcionales, técnicas y cualitativas mediante cambios sutiles e incrementales.', 'i-innovacion'),
('I2', 'I', 'Desarrollo de Innovaciones', 'transversal', 2, 'Gestión del Cambio',
 'Desarrollar resiliencia empresarial: preparar, guiar y apoyar a individuos, equipos y organización en la transición del estado operativo actual al estado futuro deseado, garantizando la adopción de nuevas metodologías.', 'i-innovacion'),
-- I3: descripción PENDIENTE — el párrafo llegó ilegible en la fuente (OCR). No inventar:
-- se confirma con el autor (Lalo López) y se completa en su propia migración.
('I3', 'I', 'Desarrollo de Innovaciones', 'transversal', 3, 'Innovación Vertical',
 NULL, 'i-innovacion'),
('I4', 'I', 'Desarrollo de Innovaciones', 'transversal', 4, 'Innovación Transversal',
 'Integrar y fomentar la colaboración entre los sistemas empresariales y bloques de responsabilidad, buscando sinergias interdepartamentales que mitiguen riesgos estructurales, reduzcan costos ocultos y creen valor futuro.', 'i-innovacion'),
('I5', 'I', 'Desarrollo de Innovaciones', 'transversal', 5, 'Desarrollo de Tecnologías Propias',
 'Invertir en I+D para generar tecnologías administrativas, productivas o informáticas propias que culminen en metodologías, patentes o sistemas únicos, convirtiéndose en activos intangibles críticos.', 'i-innovacion'),

-- H — Talento Humano (columna)
('H1', 'H', 'Talento Humano', 'columna', 1, 'Reclutamiento y Selección',
 'Adquirir talento alineado con la cultura: atraer, evaluar e integrar personal con las habilidades técnicas requeridas y los valores de la organización, asegurando encaje cultural a largo plazo y minimizando la rotación.', 'h-talento-humano'),
('H2', 'H', 'Talento Humano', 'columna', 2, 'Desarrollo de Capacidades',
 'Formar el crecimiento continuo del personal: programas de perfeccionamiento (upskilling) y reconversión (reskilling) y planes de carrera que garanticen la adaptabilidad de la fuerza laboral ante los cambios del entorno.', 'h-talento-humano'),
('H3', 'H', 'Talento Humano', 'columna', 3, 'Retención y Compromiso',
 'Fidelizar a los colaboradores y cuidar su bienestar: ambiente de trabajo positivo, compensaciones y beneficios, bienestar físico y emocional, maximizando la productividad y lealtad.', 'h-talento-humano'),
('H4', 'H', 'Talento Humano', 'columna', 4, 'Cultura Organizacional',
 'Construir y difundir los valores compartidos: el clima interno y los principios que guían las interacciones diarias y la toma de decisiones, promoviendo diversidad, equidad, inclusión y ética en todos los niveles.', 'h-talento-humano'),
('H5', 'H', 'Talento Humano', 'columna', 5, 'Impacto Empresarial',
 'Definir, medir y amplificar el valor compartido con todas las partes interesadas; identificar los retos organizacionales, sociales o ambientales que la empresa puede resolver, alineándolos con el propósito superior y reportando el impacto generado.', 'h-talento-humano'),

-- O — Operación (columna)
('O1', 'O', 'Operación', 'columna', 1, 'Producción de Soluciones',
 'Transformar materias primas o insumos en los productos, servicios o tecnologías de la oferta comercial, ejecutando y controlando los procesos productivos con los objetivos de eficiencia y costo previstos.', 'o-operaciones'),
('O2', 'O', 'Operación', 'columna', 2, 'Logística de Distribución',
 'Planificar, implementar y controlar el flujo eficiente de las soluciones hacia el mercado: movimiento y almacenamiento desde el origen hasta el punto de consumo (físico, digital o mixto), gestión de inventarios y red de entrega.', 'o-operaciones'),
('O3', 'O', 'Operación', 'columna', 3, 'Procuración de Recursos',
 'Gestionar la cadena interna de suministro y el abastecimiento: selección estratégica de proveedores, negociación de acuerdos comerciales y administración de adquisiciones, garantizando calidad y disponibilidad bajo el presupuesto establecido.', 'o-operaciones'),
('O4', 'O', 'Operación', 'columna', 4, 'Métodos de Gestión',
 'Seleccionar e implementar marcos de trabajo y metodologías de optimización de procesos (Lean, Agile, Six Sigma), estandarizando las rutinas operativas para eliminar desperdicios, mejorar decisiones y verificar el desempeño diario.', 'o-operaciones'),
('O5', 'O', 'Operación', 'columna', 5, 'Estandarización de Calidad',
 'Diseñar, planear e implementar los sistemas de control de calidad productiva, asegurando que cada bien, servicio o tecnología cumpla las especificaciones técnicas internas, las expectativas del consumidor y las normativas aplicables (por ejemplo ISO).', 'o-operaciones'),

-- C — Comercial (columna; columna del piloto, D-H5)
('C1', 'C', 'Comercial', 'columna', 1, 'Atención y Ventas',
 'Gestionar la relación directa con clientes y usuarios antes, durante y después del proceso de compra: ejecutar transacciones, atender consultas, dar seguimiento a propuestas y resolver conflictos posventa para asegurar una relación continua.', 'c-comercial'),
('C2', 'C', 'Comercial', 'columna', 2, 'Comunicación y Mercadeo',
 'Planificar, ejecutar y medir las campañas de comunicación, promoción y mercadotecnia, internas y externas, para dar a conocer la oferta, generar demanda constante y reforzar la propuesta de valor en los canales relevantes.', 'c-comercial'),
('C3', 'C', 'Comercial', 'columna', 3, 'Desarrollo de Marcas',
 'Construir la identidad organizacional y posicionar las marcas: administrar los activos intangibles (promesa de valor, identidad visual, tono de voz, percepción) para generar diferenciación y lealtad en todos los consumidores.', 'c-comercial'),
('C4', 'C', 'Comercial', 'columna', 4, 'Diseño de Ofertas y Precios',
 'Configurar soluciones comerciales que respondan a los desafíos reales de los consumidores y determinar los esquemas de precios, políticas comerciales y estructuras de comisiones alineados con la disposición a pagar del mercado.', 'c-comercial'),
('C5', 'C', 'Comercial', 'columna', 5, 'Entendimiento de Consumidores',
 'Investigar y analizar las necesidades, problemas, gustos y deseos insatisfechos de los consumidores internos y externos; identificar tendencias y nuevos comportamientos de consumo para sustentar la estrategia comercial a corto, mediano y largo plazo.', 'c-comercial'),

-- F — Finanzas (columna)
('F1', 'F', 'Finanzas', 'columna', 1, 'Administración de Ingresos',
 'Controlar los flujos de caja entrantes: monitoreo de todas las fuentes de ingresos, facturación a clientes, cuentas por cobrar, conciliación de pagos y optimización del ciclo de conversión de efectivo.', 'f-finanzas'),
('F2', 'F', 'Finanzas', 'columna', 2, 'Gestión de Egresos',
 'Controlar, analizar y aprobar los gastos operativos (OpEx) y la asignación de gastos de capital (CapEx), manteniendo la disciplina financiera y asignando recursos a las áreas de mayor retorno.', 'f-finanzas'),
('F3', 'F', 'Finanzas', 'columna', 3, 'Análisis de Ganancias',
 'Evaluar la rentabilidad real: márgenes, variaciones presupuestarias, flujos de efectivo y rentabilidad por línea de negocio, producto o cliente mediante el estado de resultados, informando decisiones estratégicas.', 'f-finanzas'),
('F4', 'F', 'Finanzas', 'columna', 4, 'Estructura Fiscal',
 'Optimizar, regular y asegurar el cumplimiento tributario: cumplir todas las obligaciones fiscales aplicables mientras se optimiza la carga fiscal de forma legal mediante una estructura financiera eficiente.', 'f-finanzas'),
('F5', 'F', 'Finanzas', 'columna', 5, 'Inversiones y Tesorería',
 'Manejar el capital, las reservas, los excedentes y la liquidez según el Balance General: análisis actuarial, gestión de fuentes de financiamiento e inversión de excedentes en instrumentos de largo plazo que maximicen el rendimiento del patrimonio.', 'f-finanzas'),

-- L — Legal (columna)
('L1', 'L', 'Legal', 'columna', 1, 'Acuerdos Comerciales',
 'Crear, revisar y gestionar los contratos y avisos legales con clientes, proveedores y socios comerciales, minimizando riesgos y asegurando que las transacciones estén legalmente protegidas entre las partes.', 'l-legal'),
('L2', 'L', 'Legal', 'columna', 2, 'Sustento Laboral',
 'Aplicar correctamente la legislación laboral: contratos de empleo, políticas internas, reglamentos y manejo de conflictos o terminaciones, protegiendo a la empresa de litigios.', 'l-legal'),
('L3', 'L', 'Legal', 'columna', 3, 'Cumplimiento Regulatorio',
 'Monitorear de forma constante y adaptar la empresa a las regulaciones de la industria, normativas sectoriales y leyes generales aplicables (sostenibilidad, ambientales, comercio internacional, ciberseguridad).', 'l-legal'),
('L4', 'L', 'Legal', 'columna', 4, 'Protección Intelectual',
 'Registrar, actualizar y resguardar patentes, marcas, avisos comerciales, dominios web, derechos de autor y secretos industriales, asumiendo el mantenimiento y la defensa legal de estos activos intangibles.', 'l-legal'),
('L5', 'L', 'Legal', 'columna', 5, 'Esquema Jurídico',
 'Regular las relaciones privadas ante la entidad jurídica: actas societarias, personalidad jurídica, relación con el consejo de administración, gobierno corporativo y protección o respuesta ante demandas y riesgos jurídicos.', 'l-legal'),

-- T — Implementación de Tecnologías (piso)
('T1', 'T', 'Implementación de Tecnologías', 'piso', 1, 'Digitalización de Datos',
 'Convertir la información física o analógica de la empresa en formatos digitales estandarizados, creando una base de datos accesible, limpia y coherente como fundamento del análisis estratégico.', 't-tecnologia'),
('T2', 'T', 'Implementación de Tecnologías', 'piso', 2, 'Procesamiento de Información',
 'Implementar herramientas, métodos y plataformas de análisis que transformen los datos y procesos digitalizados en conocimiento accionable sobre el rendimiento del negocio.', 't-tecnologia'),
('T3', 'T', 'Implementación de Tecnologías', 'piso', 3, 'Gestión de Recursos',
 'Seleccionar, desplegar y mantener las tecnologías clave que sincronicen, integren y optimicen los recursos, capacidades y habilidades humanas, digitales o automatizadas, mejorando la productividad y la visibilidad organizacional.', 't-tecnologia'),
('T4', 'T', 'Implementación de Tecnologías', 'piso', 4, 'Control de Riesgos',
 'Establecer políticas, respaldos y protocolos de mitigación de amenazas mediante software y hardware, protegiendo los activos digitales, la salud integral de los colaboradores y la información contra riesgos externos e internos.', 't-tecnologia'),
('T5', 'T', 'Implementación de Tecnologías', 'piso', 5, 'Gobernanza Informática',
 'Desarrollar la estrategia tecnológica a largo plazo: infraestructura fundacional, políticas de uso aceptable y cumplimiento normativo internacional, alineando las inversiones tecnológicas con los objetivos empresariales y su impacto socioambiental.', 't-tecnologia')
ON CONFLICT (code) DO NOTHING;

COMMIT;
