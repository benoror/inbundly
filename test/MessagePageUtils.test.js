// Inbundly: Google Inbox-style bundles for Gmail (a fork of inboxy).
// Copyright (C) 2020  Teresa Ou
// Copyright (C) 2026  Ben Orozco

import { 
    applyOptions,
    parseView,
    supportsBundling,
    isInboxView,
    isOtherBundlableView,
    getPageNumber,
    getViewKey,
    getViewFilters,
    getViewSearchScope,
    labelSearchKey,
    labelSearchTerm,
    isStarredPage,
} from '../src/util/MessagePageUtils';

const GMAIL = 'https://mail.google.com/mail/u/0/';
const url = hash => `${GMAIL}#${hash}`;

afterEach(() => {
    applyOptions({ bundleOtherViews: false });
});

test('supportsBundling - basic', () => {
    expect(supportsBundling(GMAIL)).toBe(true);
});

test('supportsBundling - inbox pages', () => {
    expect(supportsBundling(url('inbox'))).toBe(true);
    expect(supportsBundling(url('inbox/p2'))).toBe(true);
});

test('supportsBundling - inbox pages with additional params', () => {
    expect(supportsBundling(url('inbox/p2?compose=new'))).toBe(true);
    expect(supportsBundling('https://mail.google.com/mail/u/0/?zx=v1c311gis0ky#inbox'))
        .toBe(true);
    expect(supportsBundling('https://mail.google.com/mail/u/0/?zx=v1c311gis0ky#inbox/p2'))
        .toBe(true);
});

test('supportsBundling - other list views stay off by default', () => {
    expect(supportsBundling(url('label/Dentist'))).toBe(false);
    expect(supportsBundling(url('search/newsletters'))).toBe(false);
    expect(supportsBundling(url('snoozed'))).toBe(false);
});

test('supportsBundling - the pinned page is a search but never bundles', () => {
    expect(supportsBundling(url('search/is%3Astarred+label%3Ainbox'))).toBe(false);
    expect(supportsBundling(url('search/is%3Astarred+label%3Ainbox/p2'))).toBe(false);

    applyOptions({ bundleOtherViews: true });
    expect(supportsBundling(url('search/is%3Astarred+label%3Ainbox'))).toBe(false);
    expect(supportsBundling(url('search/is%3Astarred+label%3Ainbox/p2'))).toBe(false);
});

test('supportsBundling - bundleOtherViews opens the other list views', () => {
    applyOptions({ bundleOtherViews: true });

    expect(supportsBundling(url('search/newsletters'))).toBe(true);
    expect(supportsBundling(url('search/label%3AWork+older_than%3A1m/p3'))).toBe(true);
    expect(supportsBundling(url('section_query/is%3Astarred'))).toBe(true);
    expect(supportsBundling(url('label/Dentist'))).toBe(true);
    expect(supportsBundling(url('label/Parent%2FChild/p2'))).toBe(true);
    expect(supportsBundling(url('category/social'))).toBe(true);
    expect(supportsBundling(url('snoozed'))).toBe(true);
    expect(supportsBundling(url('snoozed/p2'))).toBe(true);
    expect(supportsBundling(url('starred'))).toBe(true);
    expect(supportsBundling(url('imp'))).toBe(true);
    expect(supportsBundling(url('all'))).toBe(true);
    // The Inbox is unaffected either way.
    expect(supportsBundling(url('inbox'))).toBe(true);
});

test('supportsBundling - views that are not thread lists never bundle', () => {
    applyOptions({ bundleOtherViews: true });

    // Conversations, in any view.
    expect(supportsBundling(url('inbox/FMfcgzQbfVjhKLmnpQrsTuvWxyz'))).toBe(false);
    expect(supportsBundling(url('inbox/16a3b4c5d6e7f890'))).toBe(false);
    expect(supportsBundling(url('search/newsletters/FMfcgzQbfVjhKLmnpQrsTuvWxyz'))).toBe(false);
    expect(supportsBundling(url('label/Work/FMfcgzQbfVjhKLmnpQrsTuvWxyz'))).toBe(false);
    expect(supportsBundling(url('snoozed/FMfcgzQbfVjhKLmnpQrsTuvWxyz'))).toBe(false);
    // Sent and Drafts show recipients, Spam and Trash are not curated.
    expect(supportsBundling(url('sent'))).toBe(false);
    expect(supportsBundling(url('drafts'))).toBe(false);
    expect(supportsBundling(url('spam'))).toBe(false);
    expect(supportsBundling(url('trash'))).toBe(false);
    // Not lists at all.
    expect(supportsBundling(url('settings/general'))).toBe(false);
    expect(supportsBundling(url('contacts'))).toBe(false);
    expect(supportsBundling(url('advanced-search/from=joe'))).toBe(false);
    expect(supportsBundling(url('search/'))).toBe(false);
});

test('isInboxView / isOtherBundlableView are pure of the option', () => {
    expect(isInboxView(url('inbox/p2'))).toBe(true);
    expect(isInboxView(url('label/Work'))).toBe(false);
    expect(isOtherBundlableView(url('label/Work'))).toBe(true);
    expect(isOtherBundlableView(url('inbox'))).toBe(false);
    expect(isOtherBundlableView(url('search/is%3Astarred+label%3Ainbox'))).toBe(false);
    expect(isOtherBundlableView(url('sent'))).toBe(false);
});

test('parseView', () => {
    expect(parseView(url('inbox'))).toEqual({ kind: 'inbox', arg: null, page: 1, key: 'inbox' });
    expect(parseView(url('inbox/p4')))
        .toEqual({ kind: 'inbox', arg: null, page: 4, key: 'inbox' });
    expect(parseView(url('search/label%3AWork/p2')))
        .toEqual({ kind: 'search', arg: 'label%3AWork', page: 2, key: 'search/label%3AWork' });
    expect(parseView(url('label/Parent%2FChild')))
        .toEqual({ kind: 'label', arg: 'Parent%2FChild', page: 1, key: 'label/Parent%2FChild' });
    expect(parseView(url('inbox/FMfcgzQbfVjh')).kind).toBeNull();
    expect(parseView(GMAIL).kind).toBe('inbox');
});

test('getPageNumber', () => {
    expect(getPageNumber(url('inbox'))).toBe(1);
    expect(getPageNumber(url('inbox/p2'))).toBe(2);
    expect(getPageNumber(url('inbox/p13'))).toBe(13);
    expect(getPageNumber(url('search/newsletters'))).toBe(1);
    expect(getPageNumber(url('search/newsletters/p2'))).toBe(2);
    expect(getPageNumber(url('label/Work/p5'))).toBe(5);
    expect(getPageNumber(url('snoozed/p3'))).toBe(3);
    expect(getPageNumber(url('inbox/FMfcgzQbfVjh'))).toBeUndefined();
});

test('getViewKey ignores paging and query params, separates views', () => {
    expect(getViewKey(url('inbox'))).toBe('inbox');
    expect(getViewKey(url('inbox/p2'))).toBe('inbox');
    expect(getViewKey(url('inbox/p2?compose=new'))).toBe('inbox');
    expect(getViewKey(url('search/newsletters/p2'))).toBe('search/newsletters');
    expect(getViewKey(url('search/receipts'))).toBe('search/receipts');
    expect(getViewKey(url('label/Work'))).toBe('label/Work');
    expect(getViewKey(url('snoozed/p2'))).toBe('snoozed');
    expect(getViewKey(url('search/newsletters'))).not.toBe(getViewKey(url('search/receipts')));
});

test('getViewFilters - a label view names its label', () => {
    expect(getViewFilters(url('label/Work'))).toEqual({ labels: ['work'], senders: [] });
    expect(getViewFilters(url('label/My+Label/p2'))).toEqual({ labels: ['my-label'], senders: [] });
    expect(getViewFilters(url('label/Parent%2FChild')))
        .toEqual({ labels: ['parent/child'], senders: [] });
});

test('getViewFilters - a search names its label: and from: terms', () => {
    // Inbundly's own "View all" links.
    expect(getViewFilters(url('search/label%3AInbox+label%3AWork')))
        .toEqual({ labels: ['inbox', 'work'], senders: [] });
    expect(getViewFilters(url('search/label%3AInbox+from%3A%40acme.com')))
        .toEqual({ labels: ['inbox'], senders: ['acme.com'] });
    expect(getViewFilters(url('search/label%3AInbox+from%3Ajoe%40gmail.com')))
        .toEqual({ labels: ['inbox'], senders: ['joe@gmail.com'] });
    // Hand-typed searches.
    expect(getViewFilters(url('search/from%3Ajoe%40acme.com+has%3Aattachment')))
        .toEqual({ labels: [], senders: ['acme.com'] });
    expect(getViewFilters(url('search/label%3A(Work+OR+Home)+newer_than%3A7d')))
        .toEqual({ labels: ['work'], senders: [] });
    expect(getViewFilters(url('search/-label%3AWork+from%3Ajoe')))
        .toEqual({ labels: [], senders: [] });
    expect(getViewFilters(url('search/newsletters'))).toEqual({ labels: [], senders: [] });
    expect(getViewFilters(url('section_query/label%3AWork')))
        .toEqual({ labels: ['work'], senders: [] });
});

test('getViewFilters - other views filter nothing', () => {
    expect(getViewFilters(url('inbox'))).toEqual({ labels: [], senders: [] });
    expect(getViewFilters(url('snoozed'))).toEqual({ labels: [], senders: [] });
    expect(getViewFilters(url('category/social'))).toEqual({ labels: [], senders: [] });
    expect(getViewFilters(url('inbox/FMfcgzQbfVjh'))).toEqual({ labels: [], senders: [] });
});

test('labelSearchKey folds case, spaces, hyphens, and ampersands like label: does', () => {
    expect(labelSearchKey('My Label')).toBe('my-label');
    expect(labelSearchKey('my-label')).toBe('my-label');
    expect(labelSearchKey('Work & Play')).toBe('work-play');
    expect(labelSearchKey('Parent/Child')).toBe('parent/child');
    expect(labelSearchKey(labelSearchTerm('Work & Play').replace('label%3A', ''))).toBe('work-play');
});

test('labelSearchTerm encodes a label as Gmail writes it in a search hash', () => {
    expect(labelSearchTerm('Work')).toBe('label%3AWork');
    expect(labelSearchTerm('My Label')).toBe('label%3AMy-Label');
    expect(labelSearchTerm('Parent/Child')).toBe('label%3AParent%2FChild');
    expect(labelSearchTerm('Work & Play')).toBe('label%3AWork---Play');
});

test('getViewSearchScope scopes View all to what the view shows', () => {
    expect(getViewSearchScope(url('inbox'))).toBe('label%3AInbox');
    expect(getViewSearchScope(url('inbox/p2'))).toBe('label%3AInbox');
    expect(getViewSearchScope(GMAIL)).toBe('label%3AInbox');
    expect(getViewSearchScope(url('search/newsletters+has%3Aattachment/p2')))
        .toBe('newsletters+has%3Aattachment');
    expect(getViewSearchScope(url('section_query/is%3Astarred'))).toBe('is%3Astarred');
    expect(getViewSearchScope(url('label/My+Label'))).toBe('label%3AMy-Label');
    expect(getViewSearchScope(url('label/Parent%2FChild'))).toBe('label%3AParent%2FChild');
    expect(getViewSearchScope(url('category/social'))).toBe('category%3Asocial');
    expect(getViewSearchScope(url('snoozed'))).toBe('in%3Asnoozed');
    expect(getViewSearchScope(url('starred'))).toBe('is%3Astarred');
    expect(getViewSearchScope(url('imp'))).toBe('is%3Aimportant');
    expect(getViewSearchScope(url('all'))).toBe('');
    expect(getViewSearchScope(url('inbox/FMfcgzQbfVjh'))).toBe('');
});

test('isStarredPage', () => {
    expect(isStarredPage(url('search/is%3Astarred+label%3Ainbox'))).toBe(true);
    expect(isStarredPage(url('search/is%3Astarred+label%3Ainbox/p2'))).toBe(true);
    expect(isStarredPage(url('search/is%3Astarred+label%3Ainbox/p2a'))).toBe(false);
    expect(isStarredPage(url('search/is%3Astarred+label%3Ainbox/FaNEpwVn'))).toBe(false);
    expect(isStarredPage(GMAIL)).toBe(false);
});
