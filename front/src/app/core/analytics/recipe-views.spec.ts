import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Api } from '../api/generated/api';
import { RecipeViews } from './recipe-views';

describe('RecipeViews', () => {
  let invoke: ReturnType<typeof vi.fn>;
  let views: RecipeViews;

  beforeEach(() => {
    sessionStorage.clear();
    invoke = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: Api, useValue: { invoke } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    views = TestBed.inject(RecipeViews);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('counts a recipe once per visit', () => {
    views.count('tarte-fine');
    views.count('tarte-fine');
    views.count('brownies');
    expect(invoke.mock.calls.map(([, params]) => params)).toEqual([{ slug: 'tarte-fine' }, { slug: 'brownies' }]);
  });

  it('leaves out a browser driven by a program', () => {
    vi.stubGlobal('navigator', { ...navigator, webdriver: true });
    views.count('tarte-fine');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('says nothing when the view cannot be sent', async () => {
    invoke.mockRejectedValue(new Error('offline'));
    expect(() => views.count('tarte-fine')).not.toThrow();
    await Promise.resolve();
  });
});
