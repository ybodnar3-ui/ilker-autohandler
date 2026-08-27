/* ---------------------------------------------------------------------------
   Rechtstexte (DE/EN/TR).

   ⚠️ {{...}} = Platzhalter, die nur der Inhaber ausfüllen kann (Firmenbuch,
   UID, Rechtsform). Erfundene Registernummern wären schlimmer als gar keine.
   Rechtlich maßgeblich ist die deutsche Fassung.

   Bewusst NICHT enthalten: der Hinweis auf die EU-Plattform zur Online-
   Streitbeilegung. Sie wurde am 20.07.2025 eingestellt (VO (EU) 2024/3228);
   ein Link darauf gilt inzwischen als irreführend (Unterlassungsanspruch nach UWG).
--------------------------------------------------------------------------- */
window.LEGAL = {
imprint: {
 de: {title:'Impressum', blocks:[
  {h:'Offenlegung gemäß § 5 ECG, § 14 UGB und § 25 MedienG', p:[
   'Hayat Gruppe {{Rechtsform ergänzen, z. B. e.U. oder GmbH}}<br>Groß-Enzersdorfer Straße 88b<br>1220 Wien, Österreich']},
  {h:'Kontakt', p:['Telefon: +43 676 5571571<br>E-Mail: contact@hayatgruppe.com']},
  {h:'Unternehmensgegenstand', p:['Handel mit Kraftfahrzeugen sowie Vermittlung von Kraftfahrzeugen.']},
  {h:'Firmenbuch und UID', p:[
   'Firmenbuchnummer: {{FN ergänzen}}<br>Firmenbuchgericht: {{z. B. Handelsgericht Wien}}<br>UID-Nummer: {{ATU ergänzen}}',
   'Ist das Unternehmen nicht im Firmenbuch eingetragen, entfallen die ersten beiden Zeilen.']},
  {h:'Gewerberechtliche Vorschriften', p:[
   'Gewerbeordnung 1994 (GewO 1994), abrufbar unter www.ris.bka.gv.at',
   'Gewerbe: {{genaue Gewerbeberechtigung laut GISA-Auszug}}<br>GISA-Zahl: {{GISA-Zahl ergänzen}}']},
  {h:'Gewerbe- und Aufsichtsbehörde', p:['Magistratisches Bezirksamt für den 22. Bezirk, Wien']},
  {h:'Kammerzugehörigkeit', p:['Wirtschaftskammer Wien, Landesgremium Wien des Fahrzeughandels']},
  {h:'Verbraucherschlichtung', p:[
   '{{Vom Inhaber zu bestätigen: Bereitschaft zur Teilnahme an einem Schlichtungsverfahren ja oder nein — es handelt sich um eine Willenserklärung, die niemand anderer abgeben kann.}}']},
  {h:'Grundlegende Richtung gemäß § 25 MedienG', p:[
   'Information über das Fahrzeugangebot und die Leistungen der Hayat Gruppe.',
   '{{Bei einer GmbH zusätzlich anzugeben: Geschäftsführer sowie Gesellschafter und deren Beteiligungsverhältnisse (§ 25 Abs. 2 und 3 MedienG).}}']},
  {h:'Haftung für Inhalte', p:[
   'Die Inhalte dieser Website werden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität wird keine Gewähr übernommen. Die Fahrzeugdaten werden automatisch aus dem Bestand auf willhaben übernommen; Irrtümer und Zwischenverkauf vorbehalten.',
   'Für Inhalte verlinkter fremder Websites sind ausschließlich deren Betreiber verantwortlich.']},
  {h:'Urheberrecht', p:[
   'Inhalte und Gestaltung dieser Website sind urheberrechtlich geschützt. Die Rechte an den Fahrzeugbildern liegen beim jeweiligen Rechteinhaber.']}
 ]},
 en: {title:'Legal notice', blocks:[
  {h:'Disclosure pursuant to § 5 ECG, § 14 UGB and § 25 MedienG', p:[
   'Hayat Gruppe {{add legal form, e.g. e.U. or GmbH}}<br>Groß-Enzersdorfer Straße 88b<br>1220 Vienna, Austria']},
  {h:'Contact', p:['Phone: +43 676 5571571<br>Email: contact@hayatgruppe.com']},
  {h:'Business activity', p:['Trade in and brokerage of motor vehicles.']},
  {h:'Company register and VAT', p:[
   'Company register number: {{add FN}}<br>Register court: {{e.g. Commercial Court Vienna}}<br>VAT number: {{add ATU}}',
   'If the business is not entered in the company register, the first two lines do not apply.']},
  {h:'Applicable trade regulations', p:[
   'Austrian Trade Act 1994 (GewO), available at www.ris.bka.gv.at',
   'Trade licence: {{exact licence as stated in the GISA extract}}<br>GISA number: {{add GISA number}}']},
  {h:'Trade and supervisory authority', p:['Magistratisches Bezirksamt für den 22. Bezirk (Municipal District Office for the 22nd District), Vienna']},
  {h:'Chamber membership', p:['Vienna Economic Chamber (Wirtschaftskammer Wien), Landesgremium Wien des Fahrzeughandels']},
  {h:'Consumer dispute resolution', p:[
   '{{To be confirmed by the owner: willingness to take part in an arbitration procedure, yes or no — this is a declaration of intent nobody else can make.}}']},
  {h:'Editorial direction pursuant to § 25 MedienG', p:[
   'Information about the vehicles offered and the services of Hayat Gruppe.',
   '{{For a GmbH, also required: managing directors, shareholders and their shareholdings (§ 25(2) and (3) MedienG).}}']},
  {h:'Liability for content', p:[
   'Content is compiled with care. No warranty is given for accuracy, completeness or timeliness. Vehicle data is taken automatically from the willhaben stock; prior sale and error excepted.',
   'Operators of linked external websites are solely responsible for their content.']},
  {h:'Copyright', p:[
   'Content and design of this website are protected by copyright. Rights to the vehicle images remain with the respective rights holder.']}
 ]},
 tr: {title:'Künye', blocks:[
  {h:'§ 5 ECG, § 14 UGB ve § 25 MedienG uyarınca bilgilendirme', p:[
   'Hayat Gruppe {{hukuki şekli ekleyin, örn. e.U. veya GmbH}}<br>Groß-Enzersdorfer Straße 88b<br>1220 Viyana, Avusturya']},
  {h:'İletişim', p:['Telefon: +43 676 5571571<br>E-posta: contact@hayatgruppe.com']},
  {h:'Faaliyet konusu', p:['Motorlu taşıt ticareti ve aracılığı.']},
  {h:'Ticaret sicili ve KDV numarası', p:[
   'Ticaret sicil numarası: {{FN ekleyin}}<br>Sicil mahkemesi: {{örn. Viyana Ticaret Mahkemesi}}<br>KDV kimlik numarası (UID): {{ATU ekleyin}}',
   'İşletme ticaret siciline kayıtlı değilse ilk iki satır uygulanmaz.']},
  {h:'İlgili ticaret mevzuatı', p:[
   '1994 tarihli Avusturya Ticaret Kanunu (GewO), www.ris.bka.gv.at adresinde',
   'Ruhsat: {{GISA kaydındaki tam ruhsat}}<br>GISA numarası: {{GISA numarasını ekleyin}}']},
  {h:'Ticaret ve denetim makamı', p:['Magistratisches Bezirksamt für den 22. Bezirk (Viyana 22. Bölge Belediye Dairesi)']},
  {h:'Oda üyeliği', p:['Viyana Ekonomi Odası (Wirtschaftskammer Wien), Landesgremium Wien des Fahrzeughandels']},
  {h:'Tüketici uyuşmazlık çözümü', p:[
   '{{İşletme sahibi onaylamalıdır: uzlaştırma sürecine katılma isteği var mı yok mu — bu, başkasının veremeyeceği bir irade beyanıdır.}}']},
  {h:'§ 25 MedienG uyarınca yayın yönü', p:[
   'Hayat Gruppe’nin araç portföyü ve hizmetleri hakkında bilgilendirme.',
   '{{GmbH ise ayrıca belirtilmelidir: müdürler, ortaklar ve pay oranları (§ 25/2 ve 3 MedienG).}}']},
  {h:'İçerik sorumluluğu', p:[
   'İçerikler özenle hazırlanır. Doğruluk, eksiksizlik ve güncellik konusunda garanti verilmez. Araç verileri willhaben stokundan otomatik alınır; hata ve ara satış hakkı saklıdır.',
   'Bağlantı verilen dış sitelerin içeriğinden yalnızca işletmecileri sorumludur.']},
  {h:'Telif hakkı', p:[
   'Bu sitenin içeriği ve tasarımı telif hakkı ile korunmaktadır. Araç görsellerinin hakları ilgili hak sahibine aittir.']}
 ]}
},

privacy: {
 de: {title:'Datenschutzerklärung', blocks:[
  {h:'Verantwortlicher', p:[
   'Hayat Gruppe, Groß-Enzersdorfer Straße 88b, 1220 Wien<br>E-Mail: contact@hayatgruppe.com · Telefon: +43 676 5571571']},
  {h:'Grundsatz', p:[
   'Wir verarbeiten personenbezogene Daten nur, soweit das für den Betrieb dieser Website und für die Bearbeitung Ihrer Anfragen erforderlich ist.']},
  {h:'1. Aufruf der Website (Server-Protokolle)', p:[
   'Beim Aufruf verarbeitet unser Hosting-Anbieter automatisch technische Daten: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, Browsertyp und Betriebssystem.',
   'Zweck: technische Bereitstellung sowie Sicherheit und Stabilität des Betriebs.<br>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb).<br>Speicherdauer: {{Aufbewahrungsdauer des Hosters eintragen, üblich sind wenige Tage bis 30 Tage}}']},
  {h:'2. Hosting', p:[
   'Diese Website wird von Vercel Inc. bereitgestellt. Dabei können Daten in die USA übermittelt werden. Grundlage der Übermittlung sind Standardvertragsklauseln bzw. das EU-US Data Privacy Framework.']},
  {h:'3. Schriftarten', p:[
   'Die Seite lädt Schriftarten von Google-Servern (Google Fonts). Dabei wird Ihre IP-Adresse an Google übertragen.',
   'Anbieter ist die Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Eine Übermittlung in die USA erfolgt auf Grundlage des EU-U.S. Data Privacy Framework.<br>Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (einheitliche Darstellung).']},
  {h:'4. Fahrzeugbilder', p:[
   'Die Fahrzeugbilder werden unmittelbar von Servern der willhaben internet service GmbH & Co KG geladen. Dabei wird Ihre IP-Adresse an dieses Unternehmen übertragen.',
   'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Darstellung des aktuellen Fahrzeugbestands).']},
  {h:'5. Kontaktaufnahme', p:[
   'Wenn Sie uns per Telefon, E-Mail oder WhatsApp kontaktieren, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage.',
   'Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO bei vorvertraglichen Anfragen, sonst Art. 6 Abs. 1 lit. f DSGVO.<br>Speicherdauer: {{z. B. bis zur Erledigung der Anfrage, danach im Rahmen der handels- und steuerrechtlichen Aufbewahrungsfristen — § 212 UGB, § 132 BAO: sieben Jahre}}',
   'Bei WhatsApp ist die WhatsApp Ireland Limited der Anbieter; zusätzlich gelten deren Datenschutzbestimmungen. Wenn Sie das vermeiden möchten, erreichen Sie uns per Telefon oder E-Mail.']},
  {h:'6. Sprachsuche', p:[
   'Die Sprachsuche nutzt die Spracherkennung Ihres Browsers. Je nach Browser wird die Aufnahme dabei an dessen Anbieter übertragen und dort verarbeitet, bei Google Chrome an Google. Wir speichern die Aufnahme nicht; sie wird auch nicht an uns übertragen.',
   'Die Verarbeitung erfolgt nur, wenn Sie das Mikrofon aktiv anklicken.<br>Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung). Ohne Klick auf das Mikrofon findet keine Verarbeitung statt.']},
  {h:'7. Keine Cookies, kein Tracking', p:[
   'Diese Website setzt keine Cookies und verwendet weder Analyse- noch Tracking-Dienste.',
   'Ihre Sprachauswahl wird ausschließlich lokal in Ihrem Browser gespeichert (technisch notwendige Speicherung, § 165 Abs. 3 TKG 2021); eine Einwilligung ist dafür nicht erforderlich. Die Angabe wird nicht an uns übertragen und kann jederzeit über die Browsereinstellungen gelöscht werden.']},
  {h:'Ihre Rechte', p:[
   'Ihnen stehen Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) zu. Es genügt eine Nachricht an die oben genannte Adresse.']},
  {h:'Beschwerderecht', p:[
   'Sie können sich bei der Aufsichtsbehörde beschweren:<br>Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien<br>E-Mail: dsb@dsb.gv.at']}
 ]},
 en: {title:'Privacy policy', blocks:[
  {h:'Controller', p:[
   'Hayat Gruppe, Groß-Enzersdorfer Straße 88b, 1220 Vienna<br>Email: contact@hayatgruppe.com · Phone: +43 676 5571571']},
  {h:'Principle', p:[
   'We process personal data only as far as necessary to operate this website and to handle your enquiries.']},
  {h:'1. Visiting the website (server logs)', p:[
   'When you open the site, our hosting provider automatically processes technical data: IP address, date and time, address requested, browser type and operating system.',
   'Purpose: technical delivery, security and stability.<br>Legal basis: Art. 6(1)(f) GDPR (legitimate interest in secure operation).<br>Retention: {{enter the hosting provider\'s retention period, typically a few days up to 30}}']},
  {h:'2. Hosting', p:[
   'This website is served by Vercel Inc. Data may be transferred to the USA on the basis of standard contractual clauses or the EU-US Data Privacy Framework.']},
  {h:'3. Fonts', p:[
   'The site loads fonts from Google servers (Google Fonts). In doing so, your IP address is transmitted to Google.',
   'The provider is Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland. Any transfer to the USA takes place on the basis of the EU-U.S. Data Privacy Framework.<br>Legal basis: Art. 6(1)(f) GDPR (consistent presentation).']},
  {h:'4. Vehicle images', p:[
   'Vehicle images are loaded directly from servers of willhaben internet service GmbH & Co KG. In doing so, your IP address is transmitted to that company.',
   'Legal basis: Art. 6(1)(f) GDPR (showing the current stock).']},
  {h:'5. Contacting us', p:[
   'If you contact us by phone, email or WhatsApp, we process your details to handle the enquiry.',
   'Legal basis: Art. 6(1)(b) GDPR for pre-contractual enquiries, otherwise Art. 6(1)(f) GDPR.<br>Retention: {{e.g. until the enquiry is dealt with, then within the commercial and tax retention periods — § 212 UGB, § 132 BAO: seven years}}',
   'For WhatsApp the provider is WhatsApp Ireland Limited, whose privacy terms also apply. To avoid this, contact us by phone or email.']},
  {h:'6. Voice search', p:[
   'Voice search uses your browser\'s own speech recognition. Depending on the browser, the recording is transmitted to and processed by its provider — with Google Chrome, by Google. We do not store the recording and it is never transmitted to us.',
   'Processing only happens if you actively click the microphone.<br>Legal basis: Art. 6(1)(a) GDPR (consent). Without that click, no processing takes place.']},
  {h:'7. No cookies, no tracking', p:[
   'This website sets no cookies and uses no analytics or tracking services.',
   'Your language choice is stored only locally in your browser (technically necessary storage, § 165(3) TKG 2021); no consent is required for it. It is never transmitted to us and can be cleared at any time in your browser settings.']},
  {h:'Your rights', p:[
   'You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20) and objection (Art. 21 GDPR). A message to the address above is sufficient.']},
  {h:'Right to complain', p:[
   'You may lodge a complaint with the supervisory authority:<br>Austrian Data Protection Authority, Barichgasse 40–42, 1030 Vienna<br>Email: dsb@dsb.gv.at']}
 ]},
 tr: {title:'Gizlilik politikası', blocks:[
  {h:'Sorumlu', p:[
   'Hayat Gruppe, Groß-Enzersdorfer Straße 88b, 1220 Viyana<br>E-posta: contact@hayatgruppe.com · Telefon: +43 676 5571571']},
  {h:'İlke', p:[
   'Kişisel verileri yalnızca bu sitenin işletilmesi ve taleplerinizin karşılanması için gerekli olduğu ölçüde işliyoruz.']},
  {h:'1. Siteye erişim (sunucu kayıtları)', p:[
   'Siteyi açtığınızda barındırma sağlayıcımız teknik verileri otomatik işler: IP adresi, tarih ve saat, çağrılan adres, tarayıcı türü ve işletim sistemi.',
   'Amaç: teknik sunum, güvenlik ve kararlılık.<br>Hukuki dayanak: GDPR md. 6/1-f (güvenli işletimde meşru menfaat).<br>Saklama: {{barındırma sağlayıcısının saklama süresini girin, genelde birkaç gün ile 30 gün}}']},
  {h:'2. Barındırma', p:[
   'Bu site Vercel Inc. tarafından sunulmaktadır. Veriler standart sözleşme maddeleri veya EU-US Data Privacy Framework kapsamında ABD’ye aktarılabilir.']},
  {h:'3. Yazı tipleri', p:[
   'Site, yazı tiplerini Google sunucularından (Google Fonts) yükler. Bu sırada IP adresiniz Google’a iletilir.',
   'Sağlayıcı: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, İrlanda. ABD’ye aktarım, EU-U.S. Data Privacy Framework kapsamında yapılır.<br>Hukuki dayanak: GDPR md. 6/1-f (tutarlı görünüm).']},
  {h:'4. Araç görselleri', p:[
   'Araç görselleri doğrudan willhaben internet service GmbH & Co KG sunucularından yüklenir ve IP adresiniz bu şirkete iletilir.',
   'Hukuki dayanak: GDPR md. 6/1-f (güncel stoğun gösterimi).']},
  {h:'5. Bizimle iletişim', p:[
   'Telefon, e-posta veya WhatsApp ile iletişime geçtiğinizde verdiğiniz bilgileri talebinizi işlemek için kullanırız.',
   'Hukuki dayanak: sözleşme öncesi talepler için GDPR md. 6/1-b, aksi halde md. 6/1-f.<br>Saklama: {{örn. talep sonuçlanana kadar, ardından ticari ve vergisel saklama süreleri kapsamında — § 212 UGB, § 132 BAO: yedi yıl}}',
   'WhatsApp’ta sağlayıcı WhatsApp Ireland Limited’tir ve onun gizlilik koşulları da geçerlidir. Bunu istemiyorsanız bize telefon veya e-posta ile ulaşabilirsiniz.']},
  {h:'6. Sesli arama', p:[
   'Sesli arama, tarayıcınızın kendi ses tanıma özelliğini kullanır. Tarayıcıya göre kayıt, sağlayıcısına iletilir ve orada işlenir; Google Chrome’da Google’a. Kaydı saklamıyoruz ve kayıt bize iletilmez.',
   'İşleme yalnızca mikrofona bilerek tıkladığınızda gerçekleşir.<br>Hukuki dayanak: GDPR md. 6/1-a (açık rıza). Tıklamazsanız hiçbir işleme olmaz.']},
  {h:'7. Çerez yok, izleme yok', p:[
   'Bu site çerez kullanmaz, analiz veya izleme hizmeti çalıştırmaz.',
   'Dil tercihiniz yalnızca tarayıcınızda yerel olarak saklanır (teknik olarak zorunlu saklama, § 165/3 TKG 2021); bunun için onay gerekmez. Bize iletilmez ve tarayıcı ayarlarından istediğiniz zaman silinebilir.']},
  {h:'Haklarınız', p:[
   'Erişim (md. 15), düzeltme (md. 16), silme (md. 17), işlemenin kısıtlanması (md. 18), veri taşınabilirliği (md. 20) ve itiraz (md. 21) haklarına sahipsiniz. Yukarıdaki adrese bir mesaj yeterlidir.']},
  {h:'Şikâyet hakkı', p:[
   'Denetim makamına şikâyette bulunabilirsiniz:<br>Avusturya Veri Koruma Kurumu, Barichgasse 40–42, 1030 Viyana<br>E-posta: dsb@dsb.gv.at']}
 ]}
},

terms: {
 de: {title:'AGB', note:'AGB sind in Österreich nicht gesetzlich vorgeschrieben. Diese Seite enthält noch keine AGB, sondern nur eine Übersicht der üblichen Regelungspunkte. Vor Verwendung müssen AGB anwaltlich erstellt und geprüft werden.', blocks:[
  {h:'Hinweis', p:[
   'Derzeit gelten keine Allgemeinen Geschäftsbedingungen. Für Kauf und Vermittlung gelten die gesetzlichen Bestimmungen sowie die jeweils schriftlich getroffene Vereinbarung.']},
  {h:'Was AGB üblicherweise regeln', p:[
   'Geltungsbereich · Zustandekommen des Vertrags · Preise und Zahlung · Übergabe und Abholung · Gewährleistung und Garantie · Haftung · Rücktrittsrecht bei Fernabsatz · Eigentumsvorbehalt · Gerichtsstand und anwendbares Recht.',
   '{{Von einer Rechtsanwältin oder einem Rechtsanwalt ausformulieren lassen — insbesondere die Gewährleistung beim Gebrauchtwagenkauf und das Rücktrittsrecht sind streng geregelt; fehlerhafte Klauseln sind unwirksam und können Unterlassungsansprüche nach dem UWG auslösen.}}']}
 ]},
 en: {title:'Terms', note:'Terms and conditions are not required by law in Austria. This page does not yet contain terms, only an outline of the points terms usually cover. Terms must be drafted and reviewed by a lawyer before use.', blocks:[
  {h:'Note', p:[
   'No general terms and conditions currently apply. Purchase and brokerage are governed by the statutory provisions and by the written agreement made in each individual case.']},
  {h:'What terms usually cover', p:[
   'Scope · Formation of contract · Prices and payment · Handover and collection · Warranty and guarantee · Liability · Right of withdrawal in distance selling · Retention of title · Place of jurisdiction and applicable law.',
   '{{Have a lawyer draft these — warranty on used-car sales and the right of withdrawal in particular are strictly regulated; defective clauses are void and can trigger injunction claims under the UWG.}}']}
 ]},
 tr: {title:'Şartlar', note:'Avusturya’da genel işlem şartları yasal zorunluluk değildir. Bu sayfa henüz şart içermez, yalnızca olağan düzenleme başlıklarının bir özetidir. Kullanılmadan önce şartlar bir avukat tarafından hazırlanmalı ve incelenmelidir.', blocks:[
  {h:'Bilgilendirme', p:[
   'Şu anda geçerli bir genel işlem şartı bulunmamaktadır. Alım ve aracılıkta yasal hükümler ile her durumda yazılı olarak yapılan anlaşma geçerlidir.']},
  {h:'Şartlar genelde neyi düzenler', p:[
   'Kapsam · Sözleşmenin kurulması · Fiyat ve ödeme · Teslim ve teslim alma · Ayıp sorumluluğu ve garanti · Sorumluluk · Mesafeli satışta cayma hakkı · Mülkiyeti saklı tutma · Yetkili mahkeme ve uygulanacak hukuk.',
   '{{Bir avukata hazırlatın — özellikle ikinci el araç satışında ayıp sorumluluğu ve cayma hakkı sıkı düzenlenmiştir; hatalı maddeler geçersizdir ve UWG kapsamında men davasına yol açabilir.}}']}
 ]}
}
};
