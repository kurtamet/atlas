/**
 * Legal texts of PROMETEO (BETA templates, pending review by a Chilean lawyer).
 * Spanish is the binding version; English is a courtesy translation.
 * Tokens {operator} {email} {site} are filled from ./operator at render time.
 * A paragraph that is an array renders as a bulleted list.
 */
import type { LegalDoc } from "./operator";

export type LegalSection = { h: string; p: (string | string[])[] };
export type LegalText = { title: string; summary: string; sections: LegalSection[] };

const es: Record<LegalDoc, LegalText> = {
  terms: {
    title: "Términos y Condiciones de Uso",
    summary:
      "Las reglas para usar PROMETEO: qué ofrecemos, cómo se paga, qué puedes hacer con los informes y los límites de nuestra responsabilidad. Los informes y el mapa son orientativos: no son una tasación ni asesoría legal, financiera o tributaria.",
    sections: [
      {
        h: "1. Quiénes somos y aceptación",
        p: [
          "PROMETEO ({site}) es un servicio en línea de información territorial e inmobiliaria sobre Chile, operado por {operator} (en adelante, «PROMETEO», «nosotros»). Contacto: {email}.",
          "Al usar el sitio, crear una cuenta o comprar un informe, suscripción o pack, aceptas estos Términos y Condiciones, la Política de Privacidad y la Política de Pagos y Reembolsos, que forman parte de este acuerdo. Si no estás de acuerdo, no uses el servicio.",
          "El servicio se encuentra en etapa beta: funciones, coberturas y precios pueden cambiar mientras lo mejoramos.",
        ],
      },
      {
        h: "2. El servicio",
        p: [
          "PROMETEO ofrece:",
          [
            "un mapa interactivo y fichas de lugares con indicadores de entorno, infraestructura, riesgos, medio ambiente y precios agregados, de acceso gratuito;",
            "la sección «Datos y tendencias», con acceso de prueba limitado y acceso completo incluido en las suscripciones;",
            "informes completos en PDF sobre una dirección o propiedad, que se compran por unidad, en packs o mediante una suscripción mensual.",
          ],
          "Podemos agregar, modificar o retirar capas, fuentes o funciones. Si un cambio afecta de forma sustancial algo que ya pagaste, te lo informaremos y aplicaremos la Política de Pagos y Reembolsos.",
        ],
      },
      {
        h: "3. Fuentes de datos y naturaleza de la información",
        p: [
          "La información proviene de fuentes oficiales y abiertas, entre ellas el Servicio de Impuestos Internos (SII), INE, MINVU, MMA, DTPM, CEAD, ARClim, imágenes satelitales y OpenStreetMap, además de cálculos propios. La metodología de cada capa se describe en «Fuentes y cobertura».",
          "Los precios se muestran como agregados estadísticos (por ejemplo, UF/m² por comuna o por zona) calculados a partir de información pública de transacciones y del catastro del SII. El mapa no muestra datos personales de propietarios, compradores ni vendedores.",
          "Las fuentes pueden contener errores, omisiones o desfases, y nuestros modelos simplifican la realidad. No garantizamos que la información sea completa, exacta o esté actualizada para una propiedad concreta.",
        ],
      },
      {
        h: "4. Los informes no son tasación ni asesoría",
        p: [
          "Los informes, puntajes, veredictos y textos de PROMETEO son orientativos y de carácter general. No constituyen una tasación ni una valorización profesional, ni un estudio de títulos, certificado oficial, informe técnico de la propiedad, ni asesoría legal, financiera, tributaria o de inversión.",
          "Parte del texto de los informes se redacta con ayuda de inteligencia artificial a partir de los datos del mapa. Aunque los números y gráficos los calcula nuestro sistema, el texto puede contener imprecisiones.",
          "Antes de comprar, vender, arrendar o invertir, verifica la información con las fuentes oficiales y con profesionales calificados (tasador, abogado, arquitecto, corredor). Las decisiones que tomes son de tu exclusiva responsabilidad.",
        ],
      },
      {
        h: "5. Cuenta de usuario",
        p: [
          "Para usar packs y suscripciones necesitas una cuenta asociada a tu correo electrónico. Entras con un enlace que enviamos a ese correo, sin contraseña. Eres responsable de mantener el acceso a tu correo y de la actividad de tu cuenta.",
          "Debes ser mayor de 18 años y entregar información veraz. Podemos suspender o cerrar cuentas que infrinjan estos términos, informándote cuando sea posible.",
        ],
      },
      {
        h: "6. Precios y pagos",
        p: [
          "Los precios se publican en la página «Precios», en pesos chilenos (CLP), e incluyen los impuestos que correspondan. El precio aplicable es el que se muestra al momento de pagar.",
          "Los pagos se procesan con tarjeta a través de Stripe. PROMETEO no ve ni almacena los datos completos de tu tarjeta.",
          "Las suscripciones se renuevan automáticamente cada mes, al mismo precio, hasta que las canceles desde tu cuenta. Al cancelar, el plan sigue activo hasta el final del período pagado. Los informes incluidos en un plan se renuevan cada mes y no se acumulan.",
          "Los informes de un pack no vencen mientras el servicio esté operativo y la cuenta esté activa.",
          "Cancelaciones, derecho de retracto y reembolsos se rigen por la Política de Pagos y Reembolsos.",
        ],
      },
      {
        h: "7. Uso permitido y licencia",
        p: [
          "Te otorgamos una licencia personal, no exclusiva e intransferible para usar el sitio y los informes que compres, incluido compartirlos con tus clientes o con las personas involucradas en la operación inmobiliaria que analizas.",
          "No está permitido:",
          [
            "extraer datos de forma masiva o automatizada (scraping, robots) o reconstruir nuestras bases de datos;",
            "revender, sublicenciar o publicar los datos o informes como un producto propio o en otro servicio sin autorización escrita;",
            "eludir los pagos, límites de uso o medidas de seguridad, o compartir una suscripción entre varias personas ajenas a tu equipo;",
            "usar el servicio para fines ilícitos, para identificar o perfilar a personas, o de forma que dañe el servicio o a terceros.",
          ],
          "Para integraciones, API o widgets, escríbenos a {email}.",
        ],
      },
      {
        h: "8. Propiedad intelectual",
        p: [
          "El diseño, el software, los modelos, los índices, los textos y la marca PROMETEO pertenecen a su titular o a sus licenciantes. Los datos de fuentes abiertas mantienen sus propias licencias y atribuciones (por ejemplo, © colaboradores de OpenStreetMap, ODbL).",
        ],
      },
      {
        h: "9. Responsabilidad",
        p: [
          "Prestamos el servicio con diligencia, pero no garantizamos que funcione sin interrupciones o errores. En la medida que lo permita la ley, PROMETEO no responde por decisiones de compra, venta, arriendo o inversión tomadas a partir de la información del sitio, ni por daños indirectos o lucro cesante.",
          "En la medida permitida por la ley, nuestra responsabilidad total frente a ti se limita al monto que hayas pagado a PROMETEO en los 12 meses anteriores al hecho que la origina.",
          "Nada en estos términos limita los derechos irrenunciables que te otorga la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.",
        ],
      },
      {
        h: "10. Cambios a estos términos",
        p: [
          "Podemos actualizar estos términos. Publicaremos la nueva versión con su fecha y, si el cambio es relevante, lo avisaremos en el sitio o por correo. Los cambios no afectan compras ya realizadas ni el período de suscripción ya pagado.",
        ],
      },
      {
        h: "11. Ley aplicable, reclamos y contacto",
        p: [
          "Estos términos se rigen por las leyes de la República de Chile. Puedes escribirnos a {email} para cualquier consulta o reclamo; responderemos dentro de un plazo razonable.",
          "Si eres consumidor, puedes además recurrir al Servicio Nacional del Consumidor (SERNAC) y a los tribunales competentes según la Ley N° 19.496. En los demás casos, las partes se someten a los tribunales ordinarios de la ciudad de Santiago.",
          "La versión en español de estos términos es la que prevalece; la versión en inglés es una traducción de cortesía.",
        ],
      },
    ],
  },

  privacy: {
    title: "Política de Privacidad",
    summary:
      "Qué datos personales tratamos, para qué, con quién los compartimos y cómo ejercer tus derechos, conforme a la Ley N° 19.628 sobre Protección de la Vida Privada y la Ley N° 21.719 sobre Protección de Datos Personales. Recopilamos lo mínimo: el mapa funciona sin cuenta y no mostramos datos personales de propietarios.",
    sections: [
      {
        h: "1. Responsable del tratamiento",
        p: [
          "El responsable de tus datos personales es {operator}. Para cualquier asunto de privacidad, escríbenos a {email}.",
        ],
      },
      {
        h: "2. Qué datos tratamos",
        p: [
          [
            "Datos de cuenta: tu correo electrónico, la fecha de registro y, si corresponde, tu plan, packs e historial de informes.",
            "Datos de compra: producto, monto, fecha, estado del pago y los identificadores que nos entrega Stripe (por ejemplo, cliente y sesión de pago), además del correo y, si Stripe lo informa, el nombre con que pagaste. No recibimos ni guardamos el número completo de tu tarjeta.",
            "Datos del informe: la dirección, rol o ubicación que eliges para un informe y el informe generado, para entregártelo y que puedas volver a abrirlo.",
            "Datos técnicos: dirección IP, tipo de navegador y registros técnicos que generan nuestros proveedores de hosting por seguridad y funcionamiento.",
            "Mensajes: lo que nos escribas a {email}.",
          ],
          "Datos de propiedades: el mapa usa información pública del catastro y de transacciones del SII y de otras fuentes oficiales, siempre agregada por comuna o zona o asociada a la propiedad (dirección, rol, superficie, año). No mostramos nombres, RUT ni otros datos personales de propietarios, compradores o vendedores.",
          "No tratamos datos sensibles ni recopilamos datos de menores de 18 años de forma consciente.",
        ],
      },
      {
        h: "3. Para qué los usamos y con qué base",
        p: [
          [
            "Prestar el servicio: crear y mantener tu cuenta, enviarte enlaces de acceso, generar y entregar informes, aplicar tu plan o pack (ejecución del contrato).",
            "Cobrar y llevar registros contables y tributarios (ejecución del contrato y obligación legal).",
            "Seguridad, prevención de fraude y abuso, y mejora técnica del servicio (interés legítimo).",
            "Responder tus consultas y reclamos.",
            "Enviarte novedades comerciales solo si lo autorizas; puedes retirar ese consentimiento en cualquier momento.",
          ],
          "No vendemos tus datos personales ni los usamos para publicidad de terceros.",
        ],
      },
      {
        h: "4. Inteligencia artificial",
        p: [
          "El texto de los informes se redacta con un modelo de inteligencia artificial de un proveedor externo (Anthropic). Al modelo le enviamos los datos de la ubicación y los indicadores del mapa, no tu correo ni tus datos de pago. No tomamos decisiones automatizadas que produzcan efectos jurídicos sobre ti.",
        ],
      },
      {
        h: "5. Con quién los compartimos",
        p: [
          "Solo con proveedores que nos prestan servicios y que actúan por nuestra cuenta, bajo obligaciones de confidencialidad y seguridad:",
          [
            "Stripe (procesamiento de pagos);",
            "Supabase (base de datos y autenticación);",
            "Vercel (alojamiento del sitio);",
            "el proveedor de envío de correos transaccionales;",
            "Anthropic (redacción del texto de los informes, sin datos de contacto).",
          ],
          "También podemos comunicar datos cuando lo exija la ley o una autoridad competente.",
        ],
      },
      {
        h: "6. Transferencias internacionales",
        p: [
          "Varios de estos proveedores almacenan o procesan datos fuera de Chile, principalmente en Estados Unidos y la Unión Europea. En esos casos exigimos garantías adecuadas de protección, como cláusulas contractuales, conforme a la legislación chilena.",
        ],
      },
      {
        h: "7. Cuánto tiempo los guardamos",
        p: [
          [
            "Cuenta e historial de informes: mientras la cuenta esté activa; si la eliminas, los borramos o anonimizamos dentro de 30 días, salvo lo que debamos conservar por ley.",
            "Registros de pago: el plazo que exija la normativa tributaria y contable (en general, hasta 6 años).",
            "Informes comprados sin cuenta: el tiempo necesario para que puedas volver a abrirlos con tu enlace, y luego se anonimizan.",
            "Registros técnicos: plazos cortos definidos por nuestros proveedores, normalmente inferiores a 90 días.",
          ],
        ],
      },
      {
        h: "8. Cookies y almacenamiento local",
        p: [
          "Usamos solo cookies y almacenamiento local necesarios para el funcionamiento: mantener tu sesión iniciada, recordar el idioma y controlar el período de prueba de «Datos y tendencias». No usamos cookies de publicidad ni de seguimiento de terceros. Puedes borrarlas desde tu navegador, aunque algunas funciones podrían dejar de funcionar.",
        ],
      },
      {
        h: "9. Tus derechos",
        p: [
          "Puedes ejercer en cualquier momento tus derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo (en cuanto la Ley N° 21.719 los contemple), así como retirar tu consentimiento cuando sea la base del tratamiento.",
          "Escríbenos a {email} desde el correo de tu cuenta indicando qué derecho quieres ejercer. Responderemos dentro de 30 días corridos. Si no quedas conforme, puedes recurrir a la autoridad de protección de datos competente (la Agencia de Protección de Datos Personales, una vez en funciones) o a los tribunales.",
        ],
      },
      {
        h: "10. Seguridad",
        p: [
          "Aplicamos medidas técnicas y organizativas razonables: conexiones cifradas (HTTPS), acceso restringido a la base de datos y proveedores con estándares reconocidos de seguridad. Si ocurre una vulneración de seguridad que afecte tus datos, te informaremos y notificaremos a la autoridad según lo exija la ley.",
        ],
      },
      {
        h: "11. Cambios a esta política",
        p: [
          "Si cambiamos esta política publicaremos la nueva versión con su fecha y, si el cambio es relevante, te avisaremos en el sitio o por correo.",
        ],
      },
    ],
  },

  refunds: {
    title: "Política de Pagos y Reembolsos",
    summary:
      "Cómo se cobra, cómo cancelar una suscripción y cuándo devolvemos el dinero. Si algo no funcionó, escríbenos a {email} con el comprobante de Stripe y lo resolvemos.",
    sections: [
      {
        h: "1. Pagos",
        p: [
          "Todos los precios están en pesos chilenos (CLP) e incluyen los impuestos que correspondan. Se paga con tarjeta de crédito o débito a través de Stripe, que envía el comprobante al correo indicado en el pago.",
        ],
      },
      {
        h: "2. Informe suelto",
        p: [
          "El informe se genera y entrega de inmediato después del pago, como contenido digital. Al pagar aceptas que la entrega comience de inmediato y que, por ello, no aplica el derecho de retracto del artículo 3 bis letra b) de la Ley N° 19.496 una vez entregado el informe.",
          "Te devolvemos el 100% si el informe no se generó, si se cobró dos veces o si el informe tiene un error técnico grave (por ejemplo, corresponde a otra dirección o está vacío) y no podemos corregirlo o regenerarlo dentro de 5 días hábiles desde tu aviso.",
        ],
      },
      {
        h: "3. Packs de informes",
        p: [
          "Puedes retractarte de la compra de un pack dentro de 10 días corridos desde el pago, siempre que no hayas usado ninguno de sus informes, y te devolvemos el 100%.",
          "Una vez usado algún informe del pack, no se reembolsan los informes restantes, salvo error técnico imputable a PROMETEO o lo que disponga la ley. Los informes de un pack no vencen mientras el servicio esté operativo.",
        ],
      },
      {
        h: "4. Suscripciones",
        p: [
          "La suscripción se cobra por mes adelantado y se renueva automáticamente hasta que la canceles. Puedes cancelarla en cualquier momento desde tu cuenta (Facturación y cancelación), sin costo ni permanencia; el plan sigue activo hasta el final del período pagado y no se vuelve a cobrar.",
          "No hacemos reembolsos proporcionales de un período ya iniciado, salvo:",
          [
            "si cancelas dentro de 10 días corridos desde el primer pago de la suscripción y no has generado ningún informe con ella: te devolvemos el 100%;",
            "si hubo un cobro duplicado o un cobro posterior a una cancelación correctamente realizada;",
            "si el servicio no estuvo disponible por causas imputables a PROMETEO durante una parte significativa del período.",
          ],
          "Al cambiar de plan, la diferencia se ajusta de forma proporcional en la siguiente factura, según lo calcule Stripe.",
        ],
      },
      {
        h: "5. Cómo pedir un reembolso",
        p: [
          "Escríbenos a {email} desde el correo con que pagaste, indicando la fecha, el monto y, si lo tienes, el comprobante de Stripe. Respondemos dentro de 5 días hábiles.",
          "Los reembolsos aprobados se devuelven al mismo medio de pago a través de Stripe. El abono puede tardar entre 5 y 10 días hábiles en verse reflejado, según tu banco.",
        ],
      },
      {
        h: "6. Tus derechos como consumidor",
        p: [
          "Esta política no limita los derechos irrenunciables que te otorga la Ley N° 19.496. Si no quedas conforme con nuestra respuesta, puedes acudir al SERNAC.",
        ],
      },
    ],
  },
};

const en: Record<LegalDoc, LegalText> = {
  terms: {
    title: "Terms of Use",
    summary:
      "The rules for using PROMETEO: what we offer, how payment works, what you may do with reports and the limits of our liability. Reports and the map are indicative only: they are not an appraisal, nor legal, financial or tax advice.",
    sections: [
      {
        h: "1. Who we are and acceptance",
        p: [
          "PROMETEO ({site}) is an online service providing territorial and real-estate information about Chile, operated by {operator} (“PROMETEO”, “we”). Contact: {email}.",
          "By using the site, creating an account or buying a report, subscription or pack, you accept these Terms, the Privacy Policy and the Payments and Refunds Policy, which form part of this agreement. If you do not agree, do not use the service.",
          "The service is in beta: features, coverage and prices may change while we improve it.",
        ],
      },
      {
        h: "2. The service",
        p: [
          "PROMETEO offers:",
          [
            "a free interactive map and place cards with indicators on surroundings, infrastructure, hazards, environment and aggregated prices;",
            "the “Data & trends” section, with a limited trial and full access included in subscriptions;",
            "full PDF reports about an address or property, sold individually, in packs or through a monthly subscription.",
          ],
          "We may add, change or remove layers, sources or features. If a change substantially affects something you have already paid for, we will tell you and apply the Payments and Refunds Policy.",
        ],
      },
      {
        h: "3. Data sources and nature of the information",
        p: [
          "Information comes from official and open sources, including the Chilean Internal Revenue Service (SII), INE, MINVU, MMA, DTPM, CEAD, ARClim, satellite imagery and OpenStreetMap, plus our own calculations. Each layer’s method is described under “Sources and coverage”.",
          "Prices are shown as statistical aggregates (e.g. UF/m² by comuna or zone) computed from public SII transaction and cadastre information. The map shows no personal data of owners, buyers or sellers.",
          "Sources may contain errors, omissions or delays, and our models simplify reality. We do not guarantee that the information is complete, accurate or up to date for any specific property.",
        ],
      },
      {
        h: "4. Reports are not an appraisal or advice",
        p: [
          "PROMETEO reports, scores, verdicts and texts are indicative and general. They are not an appraisal or professional valuation, title study, official certificate, technical inspection, nor legal, financial, tax or investment advice.",
          "Part of the report text is drafted with the help of artificial intelligence from map data. Numbers and charts are computed by our system, but the text may contain inaccuracies.",
          "Before buying, selling, renting or investing, verify the information with official sources and qualified professionals (appraiser, lawyer, architect, broker). Your decisions are your sole responsibility.",
        ],
      },
      {
        h: "5. User account",
        p: [
          "Packs and subscriptions require an account tied to your e-mail address. You sign in with a link we send to that address, with no password. You are responsible for keeping access to your e-mail and for activity on your account.",
          "You must be over 18 and provide truthful information. We may suspend or close accounts that breach these Terms, notifying you where possible.",
        ],
      },
      {
        h: "6. Prices and payments",
        p: [
          "Prices are published on the “Pricing” page in Chilean pesos (CLP) and include applicable taxes. The price that applies is the one shown at checkout.",
          "Card payments are processed by Stripe. PROMETEO never sees or stores your full card details.",
          "Subscriptions renew automatically every month at the same price until you cancel from your account. After cancelling, the plan stays active until the end of the paid period. Reports included in a plan reset monthly and do not roll over.",
          "Pack reports do not expire while the service is operating and the account is active.",
          "Cancellations, the right of withdrawal and refunds are governed by the Payments and Refunds Policy.",
        ],
      },
      {
        h: "7. Permitted use and licence",
        p: [
          "We grant you a personal, non-exclusive, non-transferable licence to use the site and the reports you buy, including sharing them with your clients or the parties involved in the property transaction you are analysing.",
          "You may not:",
          [
            "extract data in bulk or by automated means (scraping, bots) or rebuild our databases;",
            "resell, sublicense or publish the data or reports as your own product or in another service without written permission;",
            "bypass payments, usage limits or security measures, or share a subscription among people outside your team;",
            "use the service for unlawful purposes, to identify or profile individuals, or in a way that harms the service or others.",
          ],
          "For integrations, API or widgets, write to {email}.",
        ],
      },
      {
        h: "8. Intellectual property",
        p: [
          "The design, software, models, indices, texts and the PROMETEO brand belong to their owner or licensors. Open-data sources keep their own licences and attributions (e.g. © OpenStreetMap contributors, ODbL).",
        ],
      },
      {
        h: "9. Liability",
        p: [
          "We provide the service with due care but do not guarantee it will be uninterrupted or error-free. To the extent permitted by law, PROMETEO is not liable for purchase, sale, rental or investment decisions made on the basis of the site’s information, nor for indirect damages or loss of profit.",
          "To the extent permitted by law, our total liability to you is limited to the amount you paid PROMETEO in the 12 months before the event giving rise to it.",
          "Nothing in these Terms limits your non-waivable rights under Chilean Consumer Protection Law No. 19,496.",
        ],
      },
      {
        h: "10. Changes to these Terms",
        p: [
          "We may update these Terms. We will publish the new version with its date and, for material changes, notify you on the site or by e-mail. Changes do not affect purchases already made or a subscription period already paid.",
        ],
      },
      {
        h: "11. Governing law, complaints and contact",
        p: [
          "These Terms are governed by the laws of the Republic of Chile. Write to {email} with any question or complaint; we will reply within a reasonable time.",
          "Consumers may also turn to the National Consumer Service (SERNAC) and the competent courts under Law No. 19,496. Otherwise, the parties submit to the ordinary courts of the city of Santiago.",
          "The Spanish version of these Terms prevails; the English version is a courtesy translation.",
        ],
      },
    ],
  },

  privacy: {
    title: "Privacy Policy",
    summary:
      "What personal data we process, why, who we share it with and how to exercise your rights, under Chilean Law No. 19,628 on the Protection of Private Life and Law No. 21,719 on Personal Data Protection. We collect the minimum: the map works without an account and we show no personal data of property owners.",
    sections: [
      {
        h: "1. Data controller",
        p: ["The controller of your personal data is {operator}. For any privacy matter, write to {email}."],
      },
      {
        h: "2. Data we process",
        p: [
          [
            "Account data: your e-mail address, sign-up date and, where relevant, your plan, packs and report history.",
            "Purchase data: product, amount, date, payment status and the identifiers Stripe gives us (e.g. customer and checkout session), plus the e-mail and, if Stripe provides it, the name used to pay. We never receive or store your full card number.",
            "Report data: the address, rol or location you choose for a report and the generated report, so we can deliver it and you can reopen it.",
            "Technical data: IP address, browser type and technical logs kept by our hosting providers for security and operation.",
            "Messages: whatever you write to {email}.",
          ],
          "Property data: the map uses public SII cadastre and transaction information and other official sources, always aggregated by comuna or zone or tied to the property (address, rol, floor area, year). We show no names, RUT numbers or other personal data of owners, buyers or sellers.",
          "We do not process sensitive data and do not knowingly collect data from anyone under 18.",
        ],
      },
      {
        h: "3. Why we use it and on what basis",
        p: [
          [
            "To provide the service: create and keep your account, send sign-in links, generate and deliver reports, apply your plan or pack (performance of contract).",
            "To charge and keep accounting and tax records (performance of contract and legal obligation).",
            "Security, fraud and abuse prevention, and technical improvement of the service (legitimate interest).",
            "To answer your questions and complaints.",
            "To send you product news only if you opt in; you can withdraw that consent at any time.",
          ],
          "We do not sell your personal data or use it for third-party advertising.",
        ],
      },
      {
        h: "4. Artificial intelligence",
        p: [
          "Report text is drafted with an artificial-intelligence model from an external provider (Anthropic). We send the model the location data and map indicators, not your e-mail or payment details. We make no automated decisions that produce legal effects on you.",
        ],
      },
      {
        h: "5. Who we share it with",
        p: [
          "Only with providers that serve us and act on our behalf, under confidentiality and security obligations:",
          [
            "Stripe (payment processing);",
            "Supabase (database and authentication);",
            "Vercel (site hosting);",
            "our transactional e-mail provider;",
            "Anthropic (drafting report text, without contact data).",
          ],
          "We may also disclose data where required by law or a competent authority.",
        ],
      },
      {
        h: "6. International transfers",
        p: [
          "Several of these providers store or process data outside Chile, mainly in the United States and the European Union. In those cases we require adequate safeguards, such as contractual clauses, in line with Chilean law.",
        ],
      },
      {
        h: "7. How long we keep it",
        p: [
          [
            "Account and report history: while the account is active; if you delete it, we erase or anonymise it within 30 days, except what the law requires us to keep.",
            "Payment records: as long as tax and accounting rules require (generally up to 6 years).",
            "Reports bought without an account: as long as needed for you to reopen them with your link, then anonymised.",
            "Technical logs: short periods set by our providers, usually under 90 days.",
          ],
        ],
      },
      {
        h: "8. Cookies and local storage",
        p: [
          "We only use cookies and local storage needed for the site to work: keeping you signed in, remembering your language and tracking the “Data & trends” trial period. We use no advertising or third-party tracking cookies. You can delete them in your browser, though some features may stop working.",
        ],
      },
      {
        h: "9. Your rights",
        p: [
          "You may at any time exercise your rights of access, rectification, erasure, objection, portability and blocking (as provided by Law No. 21,719), and withdraw consent where it is the basis for processing.",
          "Write to {email} from your account e-mail stating which right you wish to exercise. We will reply within 30 calendar days. If you are not satisfied, you may turn to the competent data-protection authority (the Personal Data Protection Agency, once operating) or the courts.",
        ],
      },
      {
        h: "10. Security",
        p: [
          "We apply reasonable technical and organisational measures: encrypted connections (HTTPS), restricted database access and providers with recognised security standards. If a security breach affects your data, we will inform you and notify the authority as required by law.",
        ],
      },
      {
        h: "11. Changes to this policy",
        p: ["If we change this policy we will publish the new version with its date and, for material changes, notify you on the site or by e-mail."],
      },
    ],
  },

  refunds: {
    title: "Payments and Refunds Policy",
    summary: "How we charge, how to cancel a subscription and when we refund. If something went wrong, write to {email} with your Stripe receipt and we will sort it out.",
    sections: [
      {
        h: "1. Payments",
        p: ["All prices are in Chilean pesos (CLP) and include applicable taxes. Payment is by credit or debit card through Stripe, which e-mails the receipt to the address given at checkout."],
      },
      {
        h: "2. Single report",
        p: [
          "The report is generated and delivered immediately after payment, as digital content. By paying you agree that delivery starts immediately and that, therefore, the right of withdrawal under article 3 bis (b) of Law No. 19,496 does not apply once the report has been delivered.",
          "We refund 100% if the report was not generated, if you were charged twice, or if the report has a serious technical error (e.g. it covers a different address or is empty) that we cannot fix or regenerate within 5 business days of your notice.",
        ],
      },
      {
        h: "3. Report packs",
        p: [
          "You may withdraw from a pack purchase within 10 calendar days of payment, provided you have not used any of its reports, and we refund 100%.",
          "Once any report in the pack has been used, the remaining reports are not refunded, except for a technical error attributable to PROMETEO or as required by law. Pack reports do not expire while the service is operating.",
        ],
      },
      {
        h: "4. Subscriptions",
        p: [
          "Subscriptions are charged monthly in advance and renew automatically until you cancel. You can cancel at any time from your account (Billing and cancellation), at no cost and with no minimum term; the plan stays active until the end of the paid period and is not charged again.",
          "We do not give pro-rata refunds for a period already started, except:",
          [
            "if you cancel within 10 calendar days of the first subscription payment and have not generated any report with it: 100% refund;",
            "for a duplicate charge, or a charge after a properly completed cancellation;",
            "if the service was unavailable for reasons attributable to PROMETEO for a significant part of the period.",
          ],
          "When you change plans, the difference is prorated on the next invoice as calculated by Stripe.",
        ],
      },
      {
        h: "5. How to request a refund",
        p: [
          "Write to {email} from the e-mail you paid with, stating the date, amount and, if you have it, the Stripe receipt. We reply within 5 business days.",
          "Approved refunds go back to the same payment method through Stripe. It may take 5 to 10 business days to appear, depending on your bank.",
        ],
      },
      {
        h: "6. Your consumer rights",
        p: ["This policy does not limit your non-waivable rights under Law No. 19,496. If you are not satisfied with our answer, you can turn to SERNAC."],
      },
    ],
  },
};

export const LEGAL_TEXT: Record<"es" | "en", Record<LegalDoc, LegalText>> = { es, en };
