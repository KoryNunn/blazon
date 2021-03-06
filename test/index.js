var blazon = require('../');
var test = require('tape');
var assert = require('assert');

var TenThousand = 10000;
var OneHundredThousand = 100000;

function createSpec(){
    return blazon({
        foo: String,
        bar: Number,
        baz: {
            thing: blazon.Maybe(String),
            stuff: blazon.Custom(x => assert(x > 10, 'value must be above 10'))
        }
    });
}

test('structured data', function(t){
    t.plan(2);

    var TestSpec = blazon({
        foo: String
    });

    t.deepEqual(TestSpec({ foo: 'foo' }), { foo: 'foo' }, 'Valid data passes');

    t.throws(function(){
        TestSpec({ foo: 3 });
    }, 'Invalid data throws')
});

test('structured data, maybe default falsey value', function(t){
    t.plan(2);

    var TestSpec = blazon({
        foo: blazon.Maybe(Number, 0)
    });

    t.deepEqual(TestSpec({ }), { foo: 0 }, 'Valid data passes');

    t.throws(function(){
        TestSpec({ foo: "3" });
    }, 'Invalid data throws')
});

test('structured data - array', function(t){
    t.plan(3);

    var TestSpec = blazon([String]);

    t.ok(Array.isArray(TestSpec(['foo'])), 'Returns correct type');
    t.deepEqual(TestSpec(['foo']), ['foo'], 'Valid data passes');

    t.throws(function(){
        TestSpec({ '0': 'foo' });
    }, 'Invalid data throws')
});

test('structured data - function', function(t){
    t.plan(2);

    var TestSpec = blazon(Function);

    t.ok(typeof TestSpec(() => {}) === 'function', 'Returns correct type');

    t.throws(function(){
        TestSpec({});
    }, 'Invalid data throws')
});

test('Exactly', function(t){
    t.plan(2);

    var TestSpec = blazon({
        foo: String,
        bar: blazon.Exactly(undefined)
    });

    t.deepEqual(TestSpec({ foo: 'foo' }), { foo: 'foo' }, 'Valid data passes');

    t.throws(function(){
        TestSpec({ foo: 'foo', bar: 'bar' });
    }, 'Invalid data throws')
});

test('Exactly Or', function(t){
    t.plan(3);

    var TestSpec = blazon({
        foo: String,
        bar: blazon.Or(blazon.Exactly(null), blazon.Exactly(undefined))
    });

    t.deepEqual(TestSpec({ foo: 'foo' }), { foo: 'foo' }, 'Valid data passes');
    t.deepEqual(TestSpec({ foo: 'foo', bar: null }), { foo: 'foo', bar: null }, 'Valid data passes');

    t.throws(function(){
        TestSpec({ foo: 'foo', bar: 'bar' });
    }, 'Invalid data throws')
});

test('Fixed array', function(t){
    t.plan(3);

    var TestSpec = blazon([ Number, String, blazon.Maybe(Number) ]);

    t.deepEqual(TestSpec([1, '2']), [1, '2'], 'Valid data passes');
    t.deepEqual(TestSpec([1, '2', 3]), [1, '2', 3], 'Valid data passes');

    t.throws(function(){
        TestSpec([1, '2', '3']);
    }, 'Invalid list throws')
});

test('List', function(t){
    t.plan(2);

    var TestSpec = blazon(blazon.List(Number));

    t.deepEqual(TestSpec([1, 2, 3]), [1, 2, 3], 'Valid list of Type passes');

    t.throws(function(){
        TestSpec([1, '2', 3]);
    }, 'Invalid list throws')
});

test('List - min length', function(t){
    t.plan(2);

    var TestSpec = blazon(blazon.List(Number, 3));

    t.deepEqual(TestSpec([1, 2, 3]), [1, 2, 3], 'Valid list of Type passes');

    t.throws(function(){
        TestSpec([1, 2]);
    }, 'Invalid list throws')
});

test('List - max length', function(t){
    t.plan(2);

    var TestSpec = blazon(blazon.List(Number, 0, 3));

    t.deepEqual(TestSpec([1, 2, 3]), [1, 2, 3], 'Valid list of Type passes');

    t.throws(function(){
        TestSpec([1, 2, 3, 4]);
    }, 'Invalid list throws')
});

test('List - min and max length', function(t){
    t.plan(3);

    var TestSpec = blazon(blazon.List(Number, 3, 3));

    t.deepEqual(TestSpec([1, 2, 3]), [1, 2, 3], 'Valid list of Type passes');

    t.throws(function(){
        TestSpec([1, 2]);
    }, 'Invalid list throws')

    t.throws(function(){
        TestSpec([1, 2, 3, 4]);
    }, 'Invalid list throws')
});

function logTime(t, iterations, startTime){
    t.pass(`Completed ${iterations} iterations in ${Date.now() - startTime}ms`);
}

test('performance: create spec', function(t){
    t.plan(1);
    var iterations = OneHundredThousand;

    var startTime = Date.now();

    for(var i = 0; i < iterations; i++){
        createSpec();
    }

    logTime(t, iterations, startTime);
});

test('performance: initialise spec no errors', function(t){
    t.plan(1);
    var iterations = OneHundredThousand;

    var startTime = Date.now();

    var spec = createSpec();

    for(var i = 0; i < iterations; i++){
        spec({
            foo: 'foo',
            bar: Math.random(),
            baz: {
                thing: Math.random() > 0.5 ? 'foo' : null,
                stuff: Math.random() + 10
            }
        });
    }

    logTime(t, iterations, startTime);
});

test('performance: initialise spec some errors', function(t){
    t.plan(1);
    var iterations = TenThousand;

    var startTime = Date.now();

    var spec = createSpec();

    for(var i = 0; i < iterations; i++){
        try{
            spec({
                foo: 'foo',
                bar:  Math.random() > 0.5 ? 'foo' : 1,
                baz: {
                    thing: Math.random() > 0.5 ? 'foo' : null,
                    stuff: Math.random() * 5 + 7
                }
            });
        } catch (error){}
    }

    logTime(t, iterations, startTime);
});


test('performance: Nothing but errors', function(t){
    t.plan(1);
    var iterations = TenThousand;

    var startTime = Date.now();

    var spec = blazon({
        foo: String,
        bar: Number,
        baz: {
            thing: blazon.Maybe(String),
            stuff: blazon.Custom(x => assert(x > 10, 'value must be above 10'))
        }
    });

    for(var i = 0; i < iterations; i++){
        try{
            spec(null);
        } catch (error){}
    }

    logTime(t, iterations, startTime);
});

test('check custom constructor', function(t){
    t.plan(5);

    function MyConstructor(){}
    function SubConstructor(){}
    SubConstructor.prototype = Object.create(MyConstructor.prototype);
    SubConstructor.prototype.constructor = SubConstructor;

    var testValue = new MyConstructor();
    var testSubValue = new SubConstructor();

    var TestSpec = blazon(MyConstructor);

    t.ok(TestSpec.is(testValue), 'instanceof passes');
    t.ok(TestSpec.is(testSubValue), 'sub instanceof passes');
    t.notOk(TestSpec.is({}), 'different instance fails');
    t.notOk(TestSpec.is(3), 'Fails string check');
    t.notOk(TestSpec.is(''), 'fails Custom check');
});

test('Spec.is', function(t){
    t.plan(3);

    var NonEmptyString = blazon(blazon.And(String, blazon.Custom(x => {
        assert(x, 'Must not be empty');
        return x;
    })));

    t.ok(NonEmptyString.is('x'));

    t.notOk(NonEmptyString.is(3), 'Fails string check');
    t.notOk(NonEmptyString.is(''), 'fails Custom check');
});

test('And', function(t){
    t.plan(3);

    var NonEmptyString = blazon(blazon.And(String, blazon.Custom(x => {
        assert(x, 'Must not be empty');
        return x;
    })));

    t.ok(NonEmptyString('x'));

    t.throws(function(){
        NonEmptyString(3);
    }, 'Fails string check');
    t.throws(function(){
        NonEmptyString('');
    }, 'fails Custom check');
});

test('Or', function(t){
    t.plan(3);

    var StringOrNumber = blazon(blazon.Or(String, Number));

    t.ok(StringOrNumber('x'));
    t.ok(StringOrNumber(2));

    try {
        StringOrNumber(undefined);
    } catch (error) {
        t.ok(~error.message.indexOf('Invalid type: Expected to be one of'), 'Fails Or check');
    }
});

test('Or complex Spec', function(t){
    t.plan(5);

    var StringOrUser = blazon(blazon.Or(
        String,
        {
            firstName: String,
            lastName: String
        }
    ));

    t.ok(StringOrUser('x'));
    t.ok(StringOrUser({
        firstName: 'sam',
        lastName: 'smith'
    }));

    try {
        StringOrUser(undefined);
    } catch (error) {
        t.ok(~error.message.indexOf('Invalid type: Expected to be one of'), 'Prints nice error');
        t.ok(~error.message.indexOf('Invalid type: Expected String, Got: undefined'), 'Prints for first spec');
        t.ok(~error.message.indexOf('Object {'), 'Prints for complex spec');
    }
});

test('Cast throws on non-base-value', function(t){
    t.plan(1);

    t.throws(function(){
        blazon(blazon.Cast(blazon.Maybe(String)));
    }, 'Throws on complex type');
});

test('Cast throws on bad usage', function(t){
    t.plan(1);

    t.throws(function(){
        blazon(blazon.Cast(String, Number));
    }, 'Throws on bad usage');
});

test('Cast to string', function(t){
    t.plan(5);

    var CastToString = blazon(blazon.Cast(String));

    t.equal(CastToString('1'), '1');
    t.equal(CastToString(1), '1');
    t.equal(CastToString(true), 'true');

    t.throws(function(){
        CastToString([]);
    }, 'Fails cast from array to string');

    t.throws(function(){
        CastToString({});
    }, 'Fails cast from object to string');
});

test('Cast to number', function(t){
    t.plan(3);

    var CastToNumber = blazon(blazon.Cast(Number));

    t.equal(CastToNumber(1), 1);
    t.equal(CastToNumber('1'), 1);

    t.throws(function(){
        CastToNumber(true);
    }, 'Fails cast from bool to number');
});

test('Cast to Boolean', function(t){
    t.plan(8);

    var CastToBoolean = blazon(blazon.Cast(Boolean));

    t.equal(CastToBoolean(true), true);
    t.equal(CastToBoolean(0), false);
    t.equal(CastToBoolean(1), true);
    t.equal(CastToBoolean('true'), true);
    t.equal(CastToBoolean('false'), false);

    t.throws(function(){
        CastToBoolean('1');
    }, 'Fails cast from string to bool');

    t.throws(function(){
        CastToBoolean(4);
    }, 'Fails cast from arbitrary value to bool');

    t.throws(function(){
        CastToBoolean({});
    }, 'Fails cast from object to bool');
});

test('Cast with customConverter', function(t){
    t.plan(5);

    var IsGreaterThan10 = blazon(blazon.Cast(Number, Boolean, x => x > 10));

    t.equal(IsGreaterThan10(12), true);
    t.equal(IsGreaterThan10(0), false);
    t.equal(IsGreaterThan10(-1), false);

    t.throws(function(){
        IsGreaterThan10('true');
    }, 'Fails cast from string to bool');

    t.throws(function(){
        IsGreaterThan10(true);
    }, 'Fails cast from bool to bool');
});

test('Maybe Cast', function(t){
    t.plan(5);

    var MaybeCastToNumber = blazon(blazon.Maybe(blazon.Cast(Number)));

    t.equal(MaybeCastToNumber(1), 1);
    t.equal(MaybeCastToNumber('1'), 1);
    t.equal(MaybeCastToNumber(null), null);

    t.throws(function(){
        MaybeCastToNumber('true');
    }, 'Fails cast from string to bool');

    t.throws(function(){
        MaybeCastToNumber(true);
    }, 'Fails cast from bool to bool');
});

test('Maybe invalid usage, no initialise', function(t){
    t.plan(1);

    var InvalidMaybe = blazon(blazon.Maybe);

    try {
        InvalidMaybe('x')
    } catch (error) {
        t.ok(error.message.includes('Maybe must be initialized before use, eg: function Maybe(spec, defaultValue)'))
    }
});

test('Maybe default', function(t){
    t.plan(1);

    var DefaultOne = blazon(blazon.Maybe(Number, 1));

    var result = DefaultOne();

    t.equal(result, 1);
});

test('Maybe default in object', function(t){
    t.plan(1);

    var DefaultProperty = blazon({
        foo: blazon.Maybe(Number, 1)
    });

    var result = DefaultProperty({});

    t.equal(result.foo, 1);
});

test('Any', function(t){
    t.plan(3);

    var Any = blazon(blazon.Any());

    t.equal(Any(1), 1);
    t.equal(Any('1'), '1');
    t.equal(Any(null), null);
});

test('Any no init', function(t){
    t.plan(3);

    var Any = blazon(blazon.Any);

    t.equal(Any(1), 1);
    t.equal(Any('1'), '1');
    t.equal(Any(null), null);
});

test('ensure', function(t){
    t.plan(2);

    var typedAdd = blazon.ensure(Number, Number, (a, b) =>
        a + b
    );

    t.equal(typedAdd(1, 2), 3, 'Works for valid data');
    t.throws(function(){
        typedAdd(1);
    }, 'Throws for bad input');
});

test('ensure maybe', function(t){
    t.plan(1);

    var add = blazon.ensure(Number, blazon.Maybe(Number), (a, b) =>
        b ? a + b : a
    );

    t.equal(add(1), 1, 'Works for valid omitted data');
});

test('ensure maybe bad position', function(t){
    t.plan(2);

    var add = blazon.ensure(Number, blazon.Maybe(Number), Number, (a, b, c) =>
        a + (b || 10) + c
    );

    t.equal(add(1, null, 2), 13, 'Works for valid omitted data');
    t.throws(function(){
        add(1, null);
    }, 'Fails for Invalid omitted data');
});
