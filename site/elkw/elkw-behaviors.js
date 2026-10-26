/* ==========================================================================
   ELKW Design – Verhalten der Bausteine (optional, ohne Abhängigkeiten)
   Einbinden am Ende des body: <script src="elkw-behaviors.js"></script>
   Deckt ab: Burger/Toggle, Reiter (Pfeiltasten, Pos1/Ende), Segmente,
   Dialog/Drawer öffnen und schließen mit Fokusrückgabe.
   ========================================================================== */
(function () {
  'use strict';

  // Sprunglink: Fokus auf das Ziel setzen, ohne die Adresse zu ändern (verträgt Hash-Routing)
  document.querySelectorAll('.elkw-skiplink').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = document.getElementById((a.getAttribute('href') || '').replace('#', ''));
      if (!t) return;
      e.preventDefault();
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus();
    });
  });

  // Burger (.elkw-burger) und App-Toggle (.elkw-appbar__toggle): aria-controls → .is-open
  document.querySelectorAll('.elkw-burger, .elkw-appbar__toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = document.getElementById(b.getAttribute('aria-controls'));
      if (!t) return;
      t.classList.toggle('is-open');
      b.setAttribute('aria-expanded', t.classList.contains('is-open'));
    });
  });

  // Reiter (.elkw-tabs[role=tablist] > li > button[role=tab][aria-controls])
  document.querySelectorAll('.elkw-tabs[role="tablist"]').forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on);
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0];
        if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); select(n, true); }
      });
    });
    var current = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    if (current) select(current, false);
  });

  // Segmente (.elkw-segments button[aria-pressed]): genau eine Option aktiv
  document.querySelectorAll('.elkw-segments').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var b = e.target.closest('button[aria-pressed]');
      if (!b) return;
      group.querySelectorAll('button[aria-pressed]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      group.dispatchEvent(new CustomEvent('elkw:segment', { detail: { value: b.value || b.textContent.trim() } }));
    });
  });

  // Dialog und Drawer: [data-open="id"] öffnet per showModal(), [data-close] schließt; Fokus zurück zum Auslöser
  document.addEventListener('click', function (e) {
    var opener = e.target.closest('[data-open]');
    if (opener) {
      var d = document.getElementById(opener.getAttribute('data-open'));
      if (d && d.showModal) { d._elkwReturn = opener; d.showModal(); }
      return;
    }
    var closer = e.target.closest('dialog [data-close]');
    if (closer) closer.closest('dialog').close();
  });
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('close', function () {
      var r = d._elkwReturn;
      if (r && document.contains(r)) r.focus();
    });
  });
})();
