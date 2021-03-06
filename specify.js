var assert     = require('assert')
  , path       = require('path'), colors
  , reporters  = {}
  , assertions = 
    [ 'ok', 'equal', 'notEqual', 'deepEqual', 'notDeepEqual'
    , 'strictEqual', 'notStrictEqual' ]
  ;

require('fs').readdirSync(path.join(__dirname, 'reporters'))
  .forEach(function(reporter) {
    reporters[reporter]=require(path.join(__dirname, 'reporters', reporter));
});

module.exports = (function specify() {
  var cache     = []
    , counts    = { _totals: {ok: 0, fail: 0} }
    , spec, summary, def_summary, current_test = {}
    ;
  def_summary = summary = reporters['default.js'];
  function ensure_for(test, expect, done) {
    var ensure = {}, count  = expect, errored = [];
    current_test.errored = errored;
    assertions.forEach(function(assertion) {
      counts[test] = {ok: 0, fail: 0};
      ensure[assertion] = function () {
        try {
          assert[assertion].apply(this,arguments); 
          counts._totals.ok++;
          counts[test].ok++;
        }
        catch (err) {
          errored.push({ msg: err.message
            , assert: assertion, args: [].slice.call(arguments,0)});
          counts._totals.fail++;
          counts[test].fail++;
        }
        count--;
        if(count === 0) { 
          done(errored);
        }
      };
    });
    ensure.expect = function (nr) { count = nr; };
    return ensure;
  }
  function run_tests(tests) {
    if(tests.length === 0) {
      summary('summary', counts._totals);
      process.exit(counts._totals.fail === 0 ? 0 : -1);
    }
    else {
      var test   = tests.shift()
        , name   = test[0]
        , f      = test[1]
        , fbody  = f.toString()
        , vari   = fbody.match(/\((\w+)/m)
        , expect
        ;
      if(Array.isArray(vari) && vari.length > 0) {
        var match = fbody.match(new RegExp(vari[1] + "\\.\\w", "gm"));
        if(match) {
          expect = match.length;
          current_test = {name: name, remaining: tests};
          return f(ensure_for(name, expect, function (errors) {
            summary(name, counts[name], errors);
            run_tests(tests);
          }));
        } else {
          summary(name, {ok: 0, fail: 1}, 
            [' you need to add at least on `'+ vari[1] + '.*` call']);
        }
      } else {
        summary(name, {ok: 0, fail: 1}, 
          [' `assert` must be the first argument of your callback']);
      }
      counts._totals.fail++;
      run_tests(tests);
    }
  }
  spec = function specify_test(name, f) {
    cache.push([].slice.call(arguments,0));
  };
  spec.summary = function (f) {
    if (typeof f === 'function') {
      summary = f;
      return;
    }
    else if (typeof f === 'string') {
      var reporter = reporters[f + '.js'];
      if(typeof reporter === 'function') {
        summary = reporter;
        return;
      }
    }
    summary = def_summary;
  };
  spec.run = function run_all_tests(filter) {
    console.log();
    console.log(" ", module.parent.filename.replace(process.cwd(), ""));
    console.log();
    filter = typeof filter === "string" ? [filter] : filter;
    if(filter && filter.length !== 0) {
      var filtered_cache = [];
      filter.forEach(function (e) {
        cache.forEach(function (c){
          var name = c[0];
          if(name===e) filtered_cache.push(c);
        });
      });
      run_tests(filtered_cache);
    }
    else {
      run_tests(cache);
    }
  };

  // domains a la @pgte
  function uncaughtHandler(err) {
    err = typeof err === "string" ? new Error(err) : err; // idiotpatching
    err.stacktrace = err.stack.split("\n").splice(1)
      .map(function (l) { return l.replace(/^\s+/,""); }).join("\n");
    if(current_test.errored.length !== 0) {
      summary(current_test.name, counts[current_test.name]
        , current_test.errored);
    } else {
      counts._totals.fail++;
      counts[current_test.name].fail++;
      summary(current_test.name, counts[current_test.name]
        , [{msg: err.message || err, assert: "equal", args: ["uncaught", err]}]);
    }
    run_tests(current_test.remaining);
  }

  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', uncaughtHandler);

  return spec;
})();