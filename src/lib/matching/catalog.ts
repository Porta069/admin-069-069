/**
 * Fachkatalog — 1:1 aus dem Backend portiert (src/matching/catalog.ts).
 *
 * Alles, was der Anmelde-Funnel anbietet, steht hier und im Backend identisch.
 * Das Dashboard holt den Katalog zur Laufzeit über `GET /catalog`
 * (src/lib/matching/catalog-live.ts); diese Datei ist die Rückfallebene UND die
 * Quelle für die reine Logik (rang*, findGewerk, labelFuer), die es über die
 * Schnittstelle nicht gibt.
 *
 * GESPEICHERT WIRD IMMER `value`, NIE `label`. In der Datenbank steht `shk`,
 * nicht „Versorgungstechnik / HKLS".
 */

export interface KatalogOption {
  value: string;
  label: string;
  hint?: string;
}

/** Option einer geordneten Skala — `rang` ist der Wert, mit dem gerechnet wird. */
export interface RangOption extends KatalogOption {
  rang: number;
}

export interface Gewerk {
  value: string;
  label: string;
  /** Ausbildungsberufe dieses Gewerks (Frage 8). */
  berufe: KatalogOption[];
  /** Aufgabenbereiche, in denen man hier Erfahrung sammeln kann (freiwillig). */
  aufgaben: KatalogOption[];
  /** Meister- und Technikerqualifikationen dieses Gewerks (Frage 7). */
  meister: KatalogOption[];
}

const opt = (value: string, label: string, hint?: string): KatalogOption =>
  hint ? { value, label, hint } : { value, label };

// ── Gewerke ─────────────────────────────────────────────────────────────────
// Reihenfolge wie im Fragebogen vorgegeben.

export const GEWERKE: Gewerk[] = [
  {
    value: 'elektrotechnik',
    label: 'Elektrotechnik',
    berufe: [
      opt('elektroniker_energie_gebaeude', 'Elektroniker für Energie- und Gebäudetechnik'),
      opt('elektroniker_betriebstechnik', 'Elektroniker für Betriebstechnik'),
      opt('elektroniker_automatisierung', 'Elektroniker für Automatisierungstechnik'),
      opt('elektroniker_geraete_systeme', 'Elektroniker für Geräte und Systeme'),
      opt('elektroniker_information_tk', 'Elektroniker für Informations- und Telekommunikationstechnik'),
      opt('elektroniker_maschinen_antriebe', 'Elektroniker für Maschinen- und Antriebstechnik'),
      opt('elektroinstallateur', 'Elektroinstallateur'),
      opt('energieanlagenelektroniker', 'Energieanlagenelektroniker'),
      opt('mechatroniker', 'Mechatroniker'),
      opt('industrieelektriker', 'Industrieelektriker'),
      opt('systemelektroniker', 'Systemelektroniker'),
      opt('sonstiges_elektrotechnik', 'Sonstiger Elektroberuf'),
    ],
    aufgaben: [
      opt('energie_gebaeudetechnik', 'Energie- & Gebäudetechnik'),
      opt('betriebstechnik', 'Betriebstechnik'),
      opt('pv_solar', 'Photovoltaik / Solar'),
      opt('waermepumpen', 'Wärmepumpen'),
      opt('ladeinfrastruktur', 'Ladeinfrastruktur / E-Mobilität'),
      opt('schaltschrankbau', 'Schaltschrankbau'),
      opt('automatisierung_steuerung', 'Automatisierungs- & Steuerungstechnik'),
      opt('gebaeudeautomation', 'Gebäudeautomation / KNX'),
      opt('sicherheitstechnik', 'Sicherheits- & Brandmeldetechnik'),
      opt('kommunikation_datentechnik', 'Kommunikations- & Datentechnik'),
      opt('pruftechnik', 'Prüf- & Messtechnik (DGUV V3)'),
      opt('instandhaltung_wartung', 'Instandhaltung / Wartung'),
      opt('kundendienst_service', 'Kundendienst / Service'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_elektrotechnik', 'Elektrotechnikermeister'),
      opt('meister_informationstechnik', 'Informationstechnikermeister'),
      opt('techniker_elektrotechnik', 'Staatl. gepr. Techniker Elektrotechnik'),
      opt('techniker_automatisierung', 'Staatl. gepr. Techniker Automatisierungstechnik'),
      opt('techniker_gebaeudesystemtechnik', 'Staatl. gepr. Techniker Gebäudesystemtechnik'),
      opt('techniker_mechatronik', 'Staatl. gepr. Techniker Mechatronik'),
      opt('meister_industriemeister_elektro', 'Industriemeister Elektrotechnik'),
    ],
  },
  {
    value: 'shk',
    label: 'Versorgungstechnik / HKLS',
    berufe: [
      opt('anlagenmechaniker_shk', 'Anlagenmechaniker für Sanitär-, Heizungs- und Klimatechnik'),
      opt('gas_wasserinstallateur', 'Gas- und Wasserinstallateur'),
      opt('zentralheizungs_lueftungsbauer', 'Zentralheizungs- und Lüftungsbauer'),
      opt('mechatroniker_kaeltetechnik', 'Mechatroniker für Kältetechnik'),
      opt('ofen_luftheizungsbauer', 'Ofen- und Luftheizungsbauer'),
      opt('rohrleitungsbauer', 'Rohrleitungsbauer'),
      opt('behaelter_apparatebauer', 'Behälter- und Apparatebauer'),
      opt('anlagenmechaniker_industrie', 'Anlagenmechaniker (Industrie)'),
      opt('sonstiges_shk', 'Sonstiger Beruf der Versorgungstechnik'),
    ],
    aufgaben: [
      opt('sanitaerinstallation', 'Sanitärinstallation'),
      opt('heizungsbau', 'Heizungsbau'),
      opt('waermepumpen', 'Wärmepumpen'),
      opt('lueftung_klima', 'Lüftungs- & Klimatechnik'),
      opt('kaeltetechnik', 'Kältetechnik'),
      opt('solarthermie', 'Solarthermie'),
      opt('bad_sanierung', 'Bad-Sanierung'),
      opt('flaechenheizung', 'Flächen- & Fußbodenheizung'),
      opt('gastechnik', 'Gastechnik'),
      opt('trinkwasserhygiene', 'Trinkwasserhygiene'),
      opt('rohrleitungsbau', 'Rohrleitungsbau'),
      opt('mess_regeltechnik', 'Mess- & Regeltechnik'),
      opt('instandhaltung_wartung', 'Instandhaltung / Wartung'),
      opt('kundendienst_service', 'Kundendienst / Service'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_installateur_heizungsbauer', 'Installateur- und Heizungsbauermeister'),
      opt('meister_kaelteanlagenbauer', 'Kälteanlagenbauermeister'),
      opt('meister_ofen_luftheizungsbauer', 'Ofen- und Luftheizungsbauermeister'),
      opt('techniker_heizung_lueftung_klima', 'Staatl. gepr. Techniker Heizungs-, Lüftungs- und Klimatechnik'),
      opt('techniker_versorgungstechnik', 'Staatl. gepr. Techniker Versorgungstechnik'),
      opt('techniker_sanitaertechnik', 'Staatl. gepr. Techniker Sanitärtechnik'),
    ],
  },
  {
    value: 'maler_lackierer',
    label: 'Maler & Lackierer',
    berufe: [
      opt('maler_lackierer', 'Maler und Lackierer'),
      opt('bauten_objektbeschichter', 'Bauten- und Objektbeschichter'),
      opt('fahrzeuglackierer', 'Fahrzeuglackierer'),
      opt('verfahrensmechaniker_beschichtung', 'Verfahrensmechaniker für Beschichtungstechnik'),
      opt('sonstiges_maler', 'Sonstiger Beschichtungsberuf'),
    ],
    aufgaben: [
      opt('innenanstrich', 'Innenanstrich & Gestaltung'),
      opt('lackierarbeiten', 'Lackierarbeiten'),
      opt('tapezierarbeiten', 'Tapezierarbeiten'),
      opt('spachtel_untergrund', 'Spachtel- & Untergrundvorbereitung'),
      opt('bodenbelaege', 'Bodenbeläge'),
      opt('korrosionsschutz', 'Korrosionsschutz'),
      opt('denkmalpflege', 'Denkmalpflege & Restaurierung'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_maler_lackierer', 'Maler- und Lackierermeister'),
      opt('meister_fahrzeuglackierer', 'Fahrzeuglackierermeister'),
      opt('techniker_farbtechnik', 'Staatl. gepr. Techniker Farb- und Lacktechnik'),
      opt('restaurator_handwerk_maler', 'Restaurator im Maler- und Lackiererhandwerk'),
    ],
  },
  {
    value: 'fassade_daemmung',
    label: 'Fassade & Dämmung',
    berufe: [
      opt('maler_lackierer', 'Maler und Lackierer (Fassade)'),
      opt('stuckateur', 'Stuckateur'),
      opt('waermedaemmtechniker', 'Fachkraft Wärmedämmverbundsysteme'),
      opt('ausbaufacharbeiter', 'Ausbaufacharbeiter'),
      opt('sonstiges_fassade', 'Sonstiger Fassadenberuf'),
    ],
    aufgaben: [
      opt('wdvs', 'Wärmedämmverbundsysteme (WDVS)'),
      opt('vorgehaengte_fassade', 'Vorgehängte hinterlüftete Fassade'),
      opt('fassadenanstrich', 'Fassadenanstrich'),
      opt('putzarbeiten_aussen', 'Außenputz'),
      opt('energetische_sanierung', 'Energetische Sanierung'),
      opt('geruest_absturzsicherung', 'Gerüst & Absturzsicherung'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_stuckateur', 'Stuckateurmeister'),
      opt('meister_maler_lackierer', 'Maler- und Lackierermeister'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
      opt('gebaeudeenergieberater', 'Gebäudeenergieberater (HWK)'),
    ],
  },
  {
    value: 'trockenbau',
    label: 'Trockenbau',
    berufe: [
      opt('trockenbaumonteur', 'Trockenbaumonteur'),
      opt('ausbaufacharbeiter', 'Ausbaufacharbeiter'),
      opt('stuckateur', 'Stuckateur'),
      opt('sonstiges_trockenbau', 'Sonstiger Trockenbauberuf'),
    ],
    aufgaben: [
      opt('staenderwaende', 'Ständerwände'),
      opt('abgehaengte_decken', 'Abgehängte Decken'),
      opt('brandschutz', 'Brandschutz'),
      opt('schallschutz', 'Schallschutz'),
      opt('spachtelarbeiten', 'Spachtelarbeiten'),
      opt('dachgeschossausbau', 'Dachgeschossausbau'),
      opt('doppel_hohlraumboden', 'Doppel- & Hohlraumböden'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_stuckateur', 'Stuckateurmeister'),
      opt('meister_trockenbau', 'Trockenbaumeister'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
    ],
  },
  {
    value: 'innenausbau',
    label: 'Innenausbau',
    berufe: [
      opt('tischler_schreiner', 'Tischler / Schreiner'),
      opt('holzmechaniker', 'Holzmechaniker'),
      opt('fachkraft_moebel_kuechen', 'Fachkraft für Möbel-, Küchen- und Umzugsservice'),
      opt('ausbaufacharbeiter', 'Ausbaufacharbeiter'),
      opt('sonstiges_innenausbau', 'Sonstiger Innenausbauberuf'),
    ],
    aufgaben: [
      opt('moebelbau', 'Möbelbau'),
      opt('ladenbau', 'Laden- & Messebau'),
      opt('fenster_tueren', 'Fenster & Türen'),
      opt('treppenbau', 'Treppenbau'),
      opt('kuechenmontage', 'Küchenmontage'),
      opt('cnc_fertigung', 'CNC-Fertigung'),
      opt('montage_kunde', 'Montage beim Kunden'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_tischler', 'Tischlermeister'),
      opt('techniker_holztechnik', 'Staatl. gepr. Techniker Holztechnik'),
      opt('restaurator_handwerk_tischler', 'Restaurator im Tischlerhandwerk'),
    ],
  },
  {
    value: 'boden_fliesen',
    label: 'Boden & Fliesen',
    berufe: [
      opt('fliesen_platten_mosaikleger', 'Fliesen-, Platten- und Mosaikleger'),
      opt('estrichleger', 'Estrichleger'),
      opt('bodenleger', 'Bodenleger'),
      opt('parkettleger', 'Parkettleger'),
      opt('sonstiges_boden', 'Sonstiger Bodenberuf'),
    ],
    aufgaben: [
      opt('wand_bodenfliesen', 'Wand- & Bodenfliesen'),
      opt('grossformate', 'Großformate'),
      opt('naturstein', 'Naturstein'),
      opt('estrich', 'Estrich'),
      opt('parkett', 'Parkett & Holzböden'),
      opt('designbelaege', 'Design- & Vinylbeläge'),
      opt('abdichtung', 'Abdichtung'),
      opt('bad_sanierung', 'Bad-Sanierung'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_fliesenleger', 'Fliesen-, Platten- und Mosaiklegermeister'),
      opt('meister_estrichleger', 'Estrichlegermeister'),
      opt('meister_parkettleger', 'Parkettlegermeister'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
    ],
  },
  {
    value: 'stuck_putz',
    label: 'Stuck & Putz',
    berufe: [
      opt('stuckateur', 'Stuckateur'),
      opt('putzer', 'Putzer'),
      opt('ausbaufacharbeiter', 'Ausbaufacharbeiter'),
      opt('sonstiges_stuck', 'Sonstiger Stuck-/Putzberuf'),
    ],
    aufgaben: [
      opt('innenputz', 'Innenputz'),
      opt('aussenputz', 'Außenputz'),
      opt('stuckarbeiten', 'Stuckarbeiten'),
      opt('trockenbau', 'Trockenbau'),
      opt('wdvs', 'Wärmedämmverbundsysteme'),
      opt('denkmalpflege', 'Denkmalpflege & Restaurierung'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_stuckateur', 'Stuckateurmeister'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
      opt('restaurator_handwerk_stuck', 'Restaurator im Stuckateurhandwerk'),
    ],
  },
  {
    value: 'dach_klempnerei',
    label: 'Dachdeckerei & Bauklempnerei',
    berufe: [
      opt('dachdecker', 'Dachdecker'),
      opt('klempner', 'Klempner / Spengler'),
      opt('zimmerer', 'Zimmerer'),
      opt('sonstiges_dach', 'Sonstiger Dachberuf'),
    ],
    aufgaben: [
      opt('steildach', 'Steildach'),
      opt('flachdach', 'Flachdach'),
      opt('abdichtung', 'Abdichtung'),
      opt('bauklempnerei', 'Bauklempnerei / Dachentwässerung'),
      opt('dachbegruenung', 'Dachbegrünung'),
      opt('pv_solar', 'PV-/Solarmontage'),
      opt('fassadenbekleidung', 'Fassadenbekleidung'),
      opt('geruest_absturzsicherung', 'Gerüst & Absturzsicherung'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_dachdecker', 'Dachdeckermeister'),
      opt('meister_klempner', 'Klempnermeister'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
    ],
  },
  {
    value: 'geruestbau',
    label: 'Gerüstbau',
    berufe: [
      opt('geruestbauer', 'Gerüstbauer'),
      opt('sonstiges_geruest', 'Sonstiger Gerüstbauberuf'),
    ],
    aufgaben: [
      opt('fassadengeruest', 'Fassadengerüst'),
      opt('industriegeruest', 'Industriegerüst'),
      opt('fahrgeruest', 'Roll- & Fahrgerüst'),
      opt('wetterschutz_einhausung', 'Wetterschutz & Einhausung'),
      opt('traggeruest', 'Trag- & Lastgerüst'),
      opt('aufbauplanung_statik', 'Aufbauplanung & Statik'),
      opt('kolonnenfuehrung', 'Kolonnenführung'),
    ],
    meister: [
      opt('meister_geruestbauer', 'Gerüstbauermeister'),
      opt('geprüfter_kolonnenfuehrer', 'Geprüfter Kolonnenführer Gerüstbau'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
    ],
  },
  {
    value: 'metallbau',
    label: 'Stahl- & Metallbau',
    berufe: [
      opt('metallbauer_konstruktion', 'Metallbauer Konstruktionstechnik'),
      opt('metallbauer_nutzfahrzeuge', 'Metallbauer Nutzfahrzeugbau'),
      opt('metallbauer_metallgestaltung', 'Metallbauer Metallgestaltung'),
      opt('konstruktionsmechaniker', 'Konstruktionsmechaniker'),
      opt('industriemechaniker', 'Industriemechaniker'),
      opt('anlagenmechaniker_industrie', 'Anlagenmechaniker (Industrie)'),
      opt('schweisser', 'Schweißer (mit Prüfung)'),
      opt('sonstiges_metall', 'Sonstiger Metallberuf'),
    ],
    aufgaben: [
      opt('stahlbau', 'Stahlbau'),
      opt('schlosserei', 'Schlosserei'),
      opt('schweissen', 'Schweißen'),
      opt('tuer_tor_gelaender', 'Tür-, Tor- & Geländerbau'),
      opt('fassadenbau_metall', 'Metallfassaden'),
      opt('cnc_zerspanung', 'CNC / Zerspanung'),
      opt('blechbearbeitung', 'Blechbearbeitung'),
      opt('montage_kunde', 'Montage beim Kunden'),
      opt('instandhaltung_wartung', 'Instandhaltung / Wartung'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_metallbauer', 'Metallbauermeister'),
      opt('meister_feinwerkmechaniker', 'Feinwerkmechanikermeister'),
      opt('industriemeister_metall', 'Industriemeister Metall'),
      opt('techniker_maschinentechnik', 'Staatl. gepr. Techniker Maschinentechnik'),
      opt('techniker_metallbautechnik', 'Staatl. gepr. Techniker Metallbautechnik'),
      opt('schweissfachmann', 'Schweißfachmann / Schweißtechniker (SFM/SFI)'),
    ],
  },
  {
    value: 'zimmerei_holzbau',
    label: 'Zimmerei & Holzbau',
    berufe: [
      opt('zimmerer', 'Zimmerer'),
      opt('holzbearbeitungsmechaniker', 'Holzbearbeitungsmechaniker'),
      opt('tischler_schreiner', 'Tischler / Schreiner'),
      opt('dachdecker', 'Dachdecker'),
      opt('sonstiges_holzbau', 'Sonstiger Holzbauberuf'),
    ],
    aufgaben: [
      opt('dachstuhl', 'Dachstuhl'),
      opt('holzrahmenbau', 'Holzrahmenbau'),
      opt('fertigteilmontage', 'Fertigteilmontage'),
      opt('sanierung_altbau', 'Altbausanierung'),
      opt('treppen_innenausbau', 'Treppen & Innenausbau'),
      opt('abbund_cnc', 'Abbund / CNC'),
      opt('holzfassade', 'Holzfassade'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_zimmerer', 'Zimmerermeister'),
      opt('techniker_holztechnik', 'Staatl. gepr. Techniker Holztechnik'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
      opt('holzbau_polier', 'Geprüfter Polier Holzbau'),
    ],
  },
  {
    value: 'bauwerkserhaltung',
    label: 'Bauwerkserhaltung & Sanierung',
    berufe: [
      opt('maurer', 'Maurer'),
      opt('beton_stahlbetonbauer', 'Beton- und Stahlbetonbauer'),
      opt('bauwerksmechaniker_abbruch', 'Bauwerksmechaniker für Abbruchtechnik'),
      opt('bauten_objektbeschichter', 'Bauten- und Objektbeschichter'),
      opt('betonfertigteilbauer', 'Betonfertigteilbauer'),
      opt('sonstiges_bauerhaltung', 'Sonstiger Beruf der Bauwerkserhaltung'),
    ],
    aufgaben: [
      opt('betoninstandsetzung', 'Betoninstandsetzung'),
      opt('korrosionsschutz', 'Korrosionsschutz'),
      opt('abdichtung', 'Bauwerksabdichtung'),
      opt('rissverpressung', 'Rissverpressung & Injektion'),
      opt('bauwerksverstaerkung', 'Bauwerksverstärkung'),
      opt('abbruch', 'Abbruch & Rückbau'),
      opt('mauerwerkssanierung', 'Mauerwerkssanierung'),
      opt('denkmalpflege', 'Denkmalpflege'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_maurer_betonbauer', 'Maurer- und Betonbauermeister'),
      opt('geprüfter_polier', 'Geprüfter Polier Hochbau'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
      opt('sivv_schein', 'SIVV-Schein (Schutz, Instandsetzung, Verstärkung)'),
    ],
  },
  {
    value: 'schadensanierung',
    label: 'Brand- und Wasserschadensanierung',
    berufe: [
      opt('fachkraft_schadensanierung', 'Fachkraft für Schadensanierung'),
      opt('maler_lackierer', 'Maler und Lackierer'),
      opt('trockenbaumonteur', 'Trockenbaumonteur'),
      opt('anlagenmechaniker_shk', 'Anlagenmechaniker SHK'),
      opt('bauten_objektbeschichter', 'Bauten- und Objektbeschichter'),
      opt('sonstiges_sanierung', 'Sonstiger Sanierungsberuf'),
    ],
    aufgaben: [
      opt('wasserschaden', 'Wasserschadensanierung'),
      opt('brandschaden', 'Brandschadensanierung'),
      opt('leckortung', 'Leckortung'),
      opt('trocknungstechnik', 'Trocknungstechnik'),
      opt('schimmelsanierung', 'Schimmelsanierung'),
      opt('schadstoffsanierung', 'Schadstoffsanierung (Asbest, KMF)'),
      opt('geruchsneutralisation', 'Geruchsneutralisation'),
      opt('notdienst', 'Notdienst / Rufbereitschaft'),
      opt('bauleitung_projektleitung', 'Bauleitung / Projektleitung'),
    ],
    meister: [
      opt('meister_maler_lackierer', 'Maler- und Lackierermeister'),
      opt('geprüfter_restaurator_schaden', 'Geprüfter Sanierungs-Fachwirt'),
      opt('sachkunde_asbest_trgs519', 'Sachkunde Asbest (TRGS 519)'),
      opt('sachkunde_schimmel', 'Sachkunde Schimmelsanierung'),
      opt('techniker_bautechnik', 'Staatl. gepr. Techniker Bautechnik'),
    ],
  },
  {
    value: "garten_landschaftsbau",
    label: "Garten- & Landschaftsbau",
    berufe: [
      opt("landschaftsgaertner", "Landschaftsgärtner / Garten- und Landschaftsbauer"),
      opt("gaertner_zierpflanzen", "Gärtner Zierpflanzenbau"),
      opt("gaertner_baumschule", "Gärtner Baumschule"),
      opt("strassenbauer_galabau", "Straßenbauer (Wege & Plätze)"),
      opt("forstwirt", "Forstwirt"),
      opt("sonstiges_galabau", "Sonstiger GaLaBau-Beruf"),
    ],
    aufgaben: [
      opt("pflasterarbeiten", "Pflaster- & Wegebau"),
      opt("gartengestaltung", "Garten- & Außenanlagengestaltung"),
      opt("bepflanzung", "Bepflanzung & Begrünung"),
      opt("rasen_pflege", "Rasenbau & Grünpflege"),
      opt("baumpflege", "Baumpflege & Fällarbeiten"),
      opt("teich_wasseranlagen", "Teich- & Wasseranlagen"),
      opt("bewaesserung", "Bewässerungstechnik"),
      opt("mauern_treppen", "Mauern, Treppen & Sichtschutz"),
      opt("erdbau_galabau", "Erdbau & Geländemodellierung"),
      opt("winterdienst", "Winterdienst"),
      opt("dachbegruenung", "Dach- & Fassadenbegrünung"),
      opt("kolonnenfuehrung_galabau", "Kolonnenführung"),
    ],
    meister: [
      opt("meister_galabau", "Garten- und Landschaftsbauermeister"),
      opt("techniker_galabau", "Staatl. gepr. Techniker Garten- und Landschaftsbau"),
      opt("fachagrarwirt_baumpflege", "Fachagrarwirt Baumpflege"),
    ],
  },
  {
    value: "kfz_technik",
    label: "Kfz- & Fahrzeugtechnik",
    berufe: [
      opt("kfz_mechatroniker_pkw", "Kfz-Mechatroniker Personenkraftwagentechnik"),
      opt("kfz_mechatroniker_nutzfahrzeuge", "Kfz-Mechatroniker Nutzfahrzeugtechnik"),
      opt("kfz_mechatroniker_system_hochvolt", "Kfz-Mechatroniker System- & Hochvolttechnik"),
      opt("karosserie_fahrzeugbaumechaniker", "Karosserie- und Fahrzeugbaumechaniker"),
      opt("fahrzeuglackierer_kfz", "Fahrzeuglackierer"),
      opt("land_baumaschinenmechatroniker", "Land- und Baumaschinenmechatroniker"),
      opt("zweiradmechatroniker", "Zweiradmechatroniker"),
      opt("sonstiges_kfz", "Sonstiger Kfz-Beruf"),
    ],
    aufgaben: [
      opt("wartung_inspektion", "Wartung & Inspektion"),
      opt("fehlerdiagnose", "Fehlerdiagnose & Elektronik"),
      opt("motor_getriebe", "Motor- & Getriebeinstandsetzung"),
      opt("hochvolt_elektro", "Hochvolt- & Elektroantriebe"),
      opt("karosserie_unfallinstandsetzung", "Karosserie- & Unfallinstandsetzung"),
      opt("lackierung_aufbereitung", "Lackierung & Aufbereitung"),
      opt("reifen_fahrwerk", "Reifen- & Fahrwerksservice"),
      opt("klimaservice", "Klimaanlagenservice"),
      opt("nutzfahrzeug_aufbauten", "Nutzfahrzeuge & Aufbauten"),
      opt("land_baumaschinen", "Land- & Baumaschinen"),
      opt("hauptuntersuchung", "Vorbereitung Hauptuntersuchung"),
      opt("serviceannahme", "Serviceannahme & Kundenberatung"),
    ],
    meister: [
      opt("meister_kfz", "Kfz-Techniker-Meister"),
      opt("meister_karosserie", "Karosserie- und Fahrzeugbauermeister"),
      opt("techniker_fahrzeugtechnik", "Staatl. gepr. Techniker Fahrzeugtechnik"),
      opt("hochvolt_fachkraft", "Fachkraft für Hochvoltsysteme"),
    ],
  },
];

// ── Geordnete Skalen ────────────────────────────────────────────────────────

/** Frage 2 — anerkannter Ausbildungsabschluss. */
export const ABSCHLUSS: RangOption[] = [
  { value: 'keine', label: 'Keine anerkannte Ausbildung', rang: 0 },
  { value: 'in_ausbildung', label: 'In Ausbildung', rang: 1 },
  { value: 'berufsausbildung', label: 'Berufsausbildung', rang: 2 },
  { value: 'meister_techniker', label: 'Meister / Techniker', rang: 3 },
  { value: 'studium', label: 'Studium (Diplom / Bachelor / Master)', rang: 4 },
];

/** Frage 4 — Berufserfahrung in der aktuellen Position. */
export const ERFAHRUNG: RangOption[] = [
  { value: 'keine', label: '0 Jahre', rang: 0 },
  { value: '1_2', label: '1 bis 2 Jahre', rang: 1 },
  { value: '3_5', label: '3 bis 5 Jahre', rang: 2 },
  { value: '6_10', label: '6 bis 10 Jahre', rang: 3 },
  { value: 'ueber_10', label: 'Mehr als 10 Jahre', rang: 4 },
];

/** Frage 11 — Montagebereitschaft. */
export const MONTAGE: RangOption[] = [
  { value: 'nie', label: 'Nie', hint: 'Du bist jeden Abend zuhause — Montageeinsätze mit Übernachtung gibt es nicht.', rang: 0 },
  { value: 'gering', label: 'Gering', hint: 'Gelegentlich auf Montage — etwa 1 bis 4 Nächte pro Monat außer Haus.', rang: 1 },
  { value: 'regelmaessig', label: 'Regelmäßig', hint: 'Etwa 5 bis 15 Tage im Monat auf Montage mit Übernachtung.', rang: 2 },
  { value: 'unbeschraenkt', label: 'Unbeschränkt', hint: 'In der Regel Montag bis Freitag auf Montage — die Wochenenden zuhause.', rang: 3 },
];

/** Frage 12 — Führerschein. Rang bildet ab, was der Schein abdeckt. */
export const FUEHRERSCHEIN: RangOption[] = [
  { value: 'nein', label: 'Nein', rang: 0 },
  { value: 'fahrschule', label: 'In der Fahrschule', rang: 1 },
  { value: 'b', label: 'Klasse B (PKW)', rang: 2 },
  { value: 'c', label: 'Klasse C (LKW, Anhänger)', rang: 3 },
];

/** Frage 13 — Deutschkenntnisse. */
export const DEUTSCH: RangOption[] = [
  { value: 'keine', label: 'Keine Kenntnisse', rang: 0 },
  { value: 'grundkenntnisse', label: 'Grundkenntnisse', rang: 1 },
  { value: 'verhandlungssicher', label: 'Verhandlungssicher', rang: 2 },
  { value: 'muttersprachlich', label: 'Muttersprachlich', rang: 3 },
];

/** Frage 14 — gewünschter Eintritt. Rang ≈ Monate bis zum Beginn. */
export const START: RangOption[] = [
  { value: 'sofort', label: 'Ab sofort', rang: 0 },
  { value: '4_wochen', label: 'Innerhalb von 4 Wochen', rang: 1 },
  { value: '3_monate', label: 'Innerhalb von 3 Monaten', rang: 3 },
  { value: '6_monate', label: 'Innerhalb von 6 Monaten', rang: 6 },
  { value: '6_12_monate', label: 'In 6 bis 12 Monaten', rang: 12 },
  { value: 'umschauen', label: 'Ich schaue mich nur um', rang: 24 },
];

/** Frage 10 — Wünsche an den neuen Arbeitgeber (höchstens fünf). */
export const WUENSCHE: KatalogOption[] = [
  opt('einarbeitung', 'Gründliche Einarbeitung'),
  opt('gehalt', 'Überdurchschnittliches Gehalt'),
  opt('aufstieg', 'Aufstiegsmöglichkeiten'),
  opt('abwechslung', 'Abwechslungsreiche Tätigkeiten'),
  opt('firmenwagen', 'Firmenwagen'),
  opt('servicefahrzeug_heim', 'Servicefahrzeug mit nach Hause'),
  opt('weiterbildung', 'Unterstützung bei Weiterbildung & Entwicklung'),
  opt('team', 'Team & Arbeitsumfeld'),
  opt('urlaubstage', 'Urlaubstage'),
  opt('bonus', 'Variables Gehalt / Bonus (erfolgsorientiert)'),
  opt('start_zuhause', 'Direkt von zu Hause aus zum Kunden starten'),
  opt('werkzeug_ausstattung', 'Hochwertiges Werkzeug & Ausstattung'),
  opt('arbeitszeiten', 'Geregelte Arbeitszeiten & planbarer Feierabend'),
  opt('kurze_anfahrt', 'Kurze Anfahrtswege / Einsätze in der Region'),
  opt('ueberstunden_ausgleich', 'Fairer Umgang mit Überstunden'),
  opt('betriebliche_altersvorsorge', 'Betriebliche Altersvorsorge & Zusatzleistungen'),
  opt('kleines_team', 'Überschaubarer Betrieb statt Großkonzern'),
  opt('moderne_baustellen', 'Moderne Baustellen & saubere Organisation'),
];

export const WUENSCHE_MAX = 5;

// ── Gehalt ──────────────────────────────────────────────────────────────────

export const GEHALT_PERIODEN: KatalogOption[] = [
  opt('stuendlich', 'Stündlich'),
  opt('monatlich', 'Monatlich'),
  opt('jaehrlich', 'Jährlich'),
];

export const STUNDEN_PRO_MONAT = 173;
export const MONATE_PRO_JAHR = 12;

export interface GehaltDreiklang {
  stundeCents: number;
  monatCents: number;
  jahrCents: number;
}

/** Rechnet einen Betrag einer Periode in alle drei um. */
export function gehaltUmrechnen(
  periode: string,
  betragCents: number,
): GehaltDreiklang | null {
  if (!Number.isFinite(betragCents) || betragCents < 0) return null;
  const r = (n: number) => Math.round(n);
  switch (periode) {
    case 'stuendlich':
      return {
        stundeCents: r(betragCents),
        monatCents: r(betragCents * STUNDEN_PRO_MONAT),
        jahrCents: r(betragCents * STUNDEN_PRO_MONAT * MONATE_PRO_JAHR),
      };
    case 'monatlich':
      return {
        stundeCents: r(betragCents / STUNDEN_PRO_MONAT),
        monatCents: r(betragCents),
        jahrCents: r(betragCents * MONATE_PRO_JAHR),
      };
    case 'jaehrlich':
      return {
        stundeCents: r(betragCents / MONATE_PRO_JAHR / STUNDEN_PRO_MONAT),
        monatCents: r(betragCents / MONATE_PRO_JAHR),
        jahrCents: r(betragCents),
      };
    default:
      return null;
  }
}

// ── Nachschlagen ────────────────────────────────────────────────────────────

const gewerkByValue = new Map(GEWERKE.map((g) => [g.value, g]));

export const findGewerk = (value: string | null | undefined): Gewerk | null =>
  (value && gewerkByValue.get(value)) || null;

const rang = (skala: RangOption[], value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  return skala.find((o) => o.value === value)?.rang ?? null;
};

export const rangAbschluss = (v: unknown) => rang(ABSCHLUSS, v);
export const rangErfahrung = (v: unknown) => rang(ERFAHRUNG, v);
export const rangMontage = (v: unknown) => rang(MONTAGE, v);
export const rangFuehrerschein = (v: unknown) => rang(FUEHRERSCHEIN, v);
export const rangDeutsch = (v: unknown) => rang(DEUTSCH, v);
export const rangStart = (v: unknown) => rang(START, v);

/** Gültige Werte je Skala — für die Prüfung eingehender Daten. */
export const werte = (skala: KatalogOption[]): string[] => skala.map((o) => o.value);

/** Alle Berufs-, Aufgaben- und Meisterwerte über alle Gewerke hinweg. */
export const ALLE_BERUFE: string[] = [
  ...new Set(GEWERKE.flatMap((g) => g.berufe.map((o) => o.value))),
];
export const ALLE_AUFGABEN: string[] = [
  ...new Set(GEWERKE.flatMap((g) => g.aufgaben.map((o) => o.value))),
];
export const ALLE_MEISTER: string[] = [
  ...new Set(GEWERKE.flatMap((g) => g.meister.map((o) => o.value))),
];

/** Label zu einem Wert — für Anzeige und Begründungstexte. */
const labelIndex = new Map<string, string>();
for (const g of GEWERKE) {
  labelIndex.set(`gewerk:${g.value}`, g.label);
  for (const o of g.berufe) labelIndex.set(`beruf:${o.value}`, o.label);
  for (const o of g.aufgaben) labelIndex.set(`aufgabe:${o.value}`, o.label);
  for (const o of g.meister) labelIndex.set(`meister:${o.value}`, o.label);
}
for (const o of WUENSCHE) labelIndex.set(`wunsch:${o.value}`, o.label);
for (const o of GEHALT_PERIODEN) labelIndex.set(`periode:${o.value}`, o.label);
for (const [art, skala] of [
  ['abschluss', ABSCHLUSS],
  ['erfahrung', ERFAHRUNG],
  ['montage', MONTAGE],
  ['fuehrerschein', FUEHRERSCHEIN],
  ['deutsch', DEUTSCH],
  ['start', START],
] as const) {
  for (const o of skala) labelIndex.set(`${art}:${o.value}`, o.label);
}

export const labelFuer = (art: string, value: string): string =>
  labelIndex.get(`${art}:${value}`) ?? value;

/** Vollständiger Katalog, wie ihn das Frontend über `GET /catalog` bekommt. */
export const katalog = () => ({
  gewerke: GEWERKE,
  abschluss: ABSCHLUSS,
  erfahrung: ERFAHRUNG,
  wuensche: WUENSCHE,
  wuenscheMax: WUENSCHE_MAX,
  montage: MONTAGE,
  fuehrerschein: FUEHRERSCHEIN,
  deutsch: DEUTSCH,
  start: START,
  gehaltPerioden: GEHALT_PERIODEN,
  stundenProMonat: STUNDEN_PRO_MONAT,
  monateProJahr: MONATE_PRO_JAHR,
});
