/* Gottesdienst-Jahresplaner – liest data/gottesdienste.json (vom Export-Skript erzeugt) */
(function () {
  'use strict';

  var TZ = 'Europe/Berlin';
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MONATE_KURZ = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];
  var WT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var WT_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  var $ = function (id) { return document.getElementById(id); };
  var state = { jahr: null, ort: 'alle', sonder: true, heimat: true };
  var daten, orte = {}, jahre = [];

  // Datum/Uhrzeit immer in deutscher Ortszeit, unabhängig vom Gerät
  var teile = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false });
  function lokal(iso) {
    var p = {};
    teile.formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    var j = +p.year, m = +p.month, t = +p.day;
    return { jahr: j, monat: m - 1, tag: t, std: +p.hour % 24, min: +p.minute, wt: new Date(Date.UTC(j, m - 1, t)).getUTCDay(), schluessel: j + '-' + m + '-' + t };
  }
  function uhrzeit(l) { return l.std + (l.min ? ':' + String(l.min).padStart(2, '0') : '') + ' Uhr'; }
  function datumLang(l, mitJahr) { return WT_LANG[l.wt] + ', ' + l.tag + '. ' + MONATE[l.monat] + (mitJahr ? ' ' + l.jahr : ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // Kirchen-Symbol für Gottesdienste (einfarbig, Farbe vom Text)
  var KIRCHE = '<svg class="gd-kirche" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 1.2h2M7 0.4v2.6M7 3l-2.6 3.2V15h5.2V6.2zM9.6 9.2l3.9 1.8V15H9.6M2 15h12.4M7 15v-2.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
  function symbol(t) { return t.art === 'gd' ? KIRCHE : ''; }

  function heute() { return lokal(new Date().toISOString()); }

  function sichtbar(t) { return t.l.jahr === state.jahr && (state.ort === 'alle' || t.ort === state.ort) && (state.sonder || t.art === 'gd') && (state.heimat || !t.heimat); }

  // ---------- Steuerung ----------
  function bauSteuerung() {
    var sel = $('gd-jahr');
    sel.innerHTML = jahre.map(function (j) { return '<option value="' + j + '">' + j + '</option>'; }).join('');
    sel.addEventListener('change', function () { setze({ jahr: +sel.value }); });
    $('gd-jahr-zurueck').addEventListener('click', function () { springe(-1); });
    $('gd-jahr-vor').addEventListener('click', function () { springe(1); });

    var seg = $('gd-orte');
    var opts = [{ key: 'alle', name: 'Alle Orte' }].concat(daten.orte);
    seg.innerHTML = opts.map(function (o) {
      return '<li><button type="button" value="' + o.key + '" aria-pressed="' + (o.key === state.ort) + '">' + esc(o.name) + '</button></li>';
    }).join('');
    // Segmente: elkw-behaviors.js ist schon gelaufen, daher Verhalten hier selbst
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button[value]');
      if (b) setze({ ort: b.value });
    });
    $('gd-sonder').addEventListener('change', function (e) { setze({ sonder: e.target.checked }); });
    $('gd-heimat').addEventListener('change', function (e) { setze({ heimat: e.target.checked }); });

  }
  function springe(d) {
    var i = jahre.indexOf(state.jahr) + d;
    if (i >= 0 && i < jahre.length) setze({ jahr: jahre[i] });
  }
  function setze(neu) {
    Object.keys(neu).forEach(function (k) { state[k] = neu[k]; });
    var q = new URLSearchParams(location.search);
    q.set('jahr', state.jahr);
    if (state.ort === 'alle') q.delete('ort'); else q.set('ort', state.ort);
    if (state.sonder) q.delete('sonder'); else q.set('sonder', '0');
    if (state.heimat) q.delete('heimat'); else q.set('heimat', '0');
    history.replaceState(null, '', '?' + q.toString() + location.hash);
    zeichne();
  }

  // ---------- Ausgabe ----------
  function zeichne() {
    $('gd-jahr').value = state.jahr;
    $('gd-jahr-zurueck').disabled = jahre.indexOf(state.jahr) <= 0;
    $('gd-jahr-vor').disabled = jahre.indexOf(state.jahr) >= jahre.length - 1;
    $('gd-orte').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.value === state.ort); });
    $('gd-sonder').checked = state.sonder;
    $('gd-heimat').checked = state.heimat;

    var liste = daten.termine.filter(sichtbar);
    var proTag = {};
    liste.forEach(function (t) { (proTag[t.l.schluessel] = proTag[t.l.schluessel] || []).push(t); });

    zeichneStats();
    zeichnePlan(proTag);
    zeichneListe(liste);
  }

  function zeichneStats() {
    var imJahr = daten.termine.filter(function (t) { return t.l.jahr === state.jahr && (state.sonder || t.art === 'gd') && (state.heimat || !t.heimat); });
    var html = '<div><dt>' + (state.sonder ? 'Termine ' : 'Gottesdienste ') + state.jahr + '</dt><dd>' + imJahr.length + '</dd></div>';
    daten.orte.forEach(function (o) {
      var n = imJahr.filter(function (t) { return t.ort === o.key; }).length;
      if (n || o.key !== 'ohne') html += '<div><dt>' + esc(o.name) + '</dt><dd>' + n + '</dd></div>';
    });
    $('gd-stats').innerHTML = html;
  }

  function zeit(l) { return l.std + ':' + String(l.min).padStart(2, '0'); }

  // Plan je Monat: Zeilen = Tage mit Gottesdienst, Spalten = Orte, Zelle = Uhrzeit(en)
  function zeichnePlan(proTag) {
    var h = heute(), jetzt = new Date();
    var imJahr = daten.termine.filter(function (t) { return t.l.jahr === state.jahr && (state.sonder || t.art === 'gd') && (state.heimat || !t.heimat); });
    var spalten = state.ort !== 'alle' ? [orte[state.ort]] : daten.orte.filter(function (o) {
      return o.key !== 'ohne' || imJahr.some(function (t) { return t.ort === 'ohne'; });
    });
    var html = '';
    for (var m = 0; m < 12; m++) {
      var tage = Object.keys(proTag).filter(function (k) { return proTag[k][0].l.monat === m; })
        .sort(function (a, b) { return proTag[a][0].l.tag - proTag[b][0].l.tag; });
      var aktuell = h.jahr === state.jahr && h.monat === m;
      html += '<section class="gd-monat-plan' + (aktuell ? ' gd-monat-plan--aktuell' : '') + '" aria-labelledby="gd-m' + m + '">' +
        '<h3 id="gd-m' + m + '">' + MONATE[m] + (aktuell ? ' <span class="gd-hinweis">(aktueller Monat)</span>' : '') + '</h3>';
      if (!tage.length) { html += '<p class="small gd-keine">Keine Gottesdienste eingetragen.</p></section>'; continue; }
      html += '<div class="gd-mwrap"><table class="elkw-table gd-mtab"><thead><tr><th scope="col">Datum</th>' +
        spalten.map(function (o) { return '<th scope="col" class="gd-z"><span class="gd-lang">' + esc(o.spalte || o.name) + '</span><abbr class="gd-kurz" title="' + esc(o.name) + '">' + esc(o.kurz || o.spalte || o.name) + '</abbr></th>'; }).join('') + '</tr></thead><tbody>';
      tage.forEach(function (k) {
        var e = proTag[k], l = e[0].l;
        var vorbei = e.every(function (t) { return new Date(t.ende || t.start) < jetzt; });
        var istHeute = h.jahr === l.jahr && h.monat === l.monat && h.tag === l.tag;
        html += '<tr class="' + (vorbei ? 'gd-vorbei' : '') + (istHeute ? ' gd-heute' : '') + (l.wt === 0 ? ' gd-so' : '') + '">' +
          '<th scope="row"><button type="button" class="gd-datum" data-tag="' + k + '" aria-label="' + esc(datumLang(l, false) + ', Details') + '">' + WT[l.wt] + ' ' + l.tag + '.' + (m + 1) + '.</button></th>';
        spalten.forEach(function (o) {
          var hier = e.filter(function (t) { return t.ort === o.key; });
          html += '<td class="gd-z">' + (hier.length
            ? hier.map(function (t) { return '<button type="button" class="gd-zeit' + (t.heimat ? ' gd-heimat' : '') + '" data-tag="' + k + '" title="' + esc(t.titel + (t.zusatz ? ' – ' + t.zusatz : '')) + '" aria-label="' + esc(o.name + ', ' + (t.ganztags ? 'ganztägig' : uhrzeit(t.l)) + ', ' + (t.heimat ? 'Heimatkirche' : t.art === 'gd' ? 'Gottesdienst' : 'Sonderveranstaltung') + ': ' + t.titel) + '">' + symbol(t) + '<span class="gd-uhr">' + (t.ganztags ? 'ganzt.' : zeit(t.l)) + '</span>' + (t.heimat ? '<span class="gd-hk" aria-hidden="true">HK</span>' : '') + '</button>' + (t.prediger ? '<span class="gd-prediger">' + esc(t.prediger) + '</span>' : ''); }).join('')
            : '<span aria-hidden="true">–</span><span class="sr-only">kein Gottesdienst</span>') + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table></div></section>';
    }
    $('gd-plan').style.setProperty('--gd-spalten', spalten.length);
    $('gd-plan').innerHTML = html;
    $('gd-plan').querySelectorAll('[data-tag]').forEach(function (b) {
      b.addEventListener('click', function () { zeigeTag(proTag[b.dataset.tag], b); });
    });
  }

  function eintragHtml(t, ohneDatum) {
    var l = t.l;
    var vorbei = new Date(t.ende || t.start) < new Date();
    var zeile = symbol(t) + (t.art === 'gd' ? '<span class="sr-only">Gottesdienst, </span>' : '') + (t.ganztags ? 'ganztägig' : uhrzeit(l)) + ' · <span class="gd-ort">' + esc(orte[t.ort].name) + '</span>';
    if (t.heimat) zeile += ' · <span class="gd-heimat-text">Heimatkirche</span>';
    return '<li class="gd-eintrag' + (vorbei ? ' gd-vorbei' : '') + (t.heimat ? ' gd-heimat' : '') + '">' +
      (ohneDatum ? '' : '<div class="elkw-dateblock elkw-dateblock--small" aria-hidden="true"><div class="elkw-dateblock__top"><div class="wd">' + WT[l.wt] + '</div><div class="day">' + String(l.tag).padStart(2, '0') + '</div><div class="mon">' + MONATE_KURZ[l.monat] + '</div></div><div class="elkw-dateblock__bottom">' + l.jahr + '</div></div>') +
      '<div class="elkw-eventlist__body"><h3>' + esc(t.titel) + '</h3>' +
      (ohneDatum ? '' : '<p class="sr-only">' + datumLang(l, true) + '</p>') +
      '<p class="gd-zeile">' + zeile + '</p>' +
      (t.prediger ? '<p>Predigt: ' + esc(t.prediger) + '</p>' : '') +
      (t.zusatz ? '<p>' + esc(t.zusatz) + '</p>' : '') +
      '</div></li>';
  }

  function zeichneListe(liste) {
    if (!liste.length) {
      $('gd-liste').innerHTML = '<div class="elkw-empty"><h3>Keine Termine</h3><p>Für diese Auswahl sind ' + state.jahr + ' keine Gottesdienste eingetragen.</p></div>';
      return;
    }
    var html = '', monat = -1;
    liste.forEach(function (t) {
      if (t.l.monat !== monat) {
        if (monat >= 0) html += '</ul>';
        monat = t.l.monat;
        html += '<h3 class="gd-monat">' + MONATE[monat] + ' ' + state.jahr + '</h3><ul class="elkw-eventlist">';
      }
      html += eintragHtml(t);
    });
    $('gd-liste').innerHTML = html + '</ul>';
  }

  function zeigeTag(eintraege, ausloeser) {
    var d = $('gd-tag');
    $('gd-tag-titel').textContent = datumLang(eintraege[0].l, true);
    $('gd-tag-inhalt').innerHTML = '<ul class="elkw-eventlist gd-tag-liste">' + eintraege.map(function (t) { return eintragHtml(t, true); }).join('') + '</ul>';
    d._elkwReturn = ausloeser;
    d.showModal();
  }

  function naechster() {
    var jetzt = new Date();
    var t = daten.termine.filter(function (x) { return x.art === 'gd' && new Date(x.start) >= jetzt; })[0];
    $('gd-naechster').innerHTML = t
      ? 'Nächster Gottesdienst: ' + esc(t.titel) + ' – ' + datumLang(t.l, t.l.jahr !== heute().jahr) + ', ' + uhrzeit(t.l) + ', ' + esc(orte[t.ort].name) + '.'
      : '';
  }

  // ---------- Start ----------
  fetch('data/gottesdienste.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (json) {
      daten = json;
      daten.orte.forEach(function (o) { orte[o.key] = o; });
      daten.termine.forEach(function (t) { t.l = lokal(t.start); if (!orte[t.ort]) t.ort = 'ohne'; });
      daten.termine.forEach(function (t) { if (jahre.indexOf(t.l.jahr) < 0) jahre.push(t.l.jahr); });
      jahre.sort();

      var q = new URLSearchParams(location.search);
      var hj = heute().jahr;
      state.jahr = jahre.indexOf(+q.get('jahr')) >= 0 ? +q.get('jahr') : (jahre.indexOf(hj) >= 0 ? hj : jahre[jahre.length - 1]);
      if (q.get('ort') && orte[q.get('ort')]) state.ort = q.get('ort');
      if (q.get('sonder') === '0') state.sonder = false;
      if (q.get('heimat') === '0') state.heimat = false;

      var s = lokal(daten.stand);
      $('gd-stand').textContent = 'Stand der Daten: ' + s.tag + '. ' + MONATE[s.monat] + ' ' + s.jahr + ', ' + uhrzeit(s) + '. Änderungen vorbehalten.';

      bauSteuerung();
      naechster();
      zeichne();
      $('gd-laden').remove();
      $('gd-app').hidden = false;
    })
    .catch(function (err) {
      $('gd-laden').remove();
      $('gd-meldung').innerHTML = '<div class="elkw-alert elkw-alert--fehler" role="alert"><span class="elkw-alert__title">Fehler:</span><p>Die Gottesdienst-Termine konnten nicht geladen werden (' + esc(err.message) + '). Bitte später noch einmal versuchen.</p></div>';
    });
})();
