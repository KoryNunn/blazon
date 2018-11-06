var blazon = require('../');
var test = require('tape');
var assert = require('assert');

var TenThousand = 10000;
var OneHundredThousand = 100000;
var OneMillion = 1000000;

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

function logTime(t, iterations, startTime){
    t.pass(`Completed ${iterations} iterations in ${Date.now() - startTime}ms`);
}

test('performance: create spec', function(t){
    t.plan(1);
    var iterations = OneMillion;

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

test('Spec.is', function(t){
    t.plan(3);

    var NonEmptyString = blazon(blazon.Union(String, blazon.Custom(x => assert(x, 'Must not be empty'))));

    t.ok(NonEmptyString.is('x'));

    t.notOk(NonEmptyString.is(3), 'Fails string check');
    t.notOk(NonEmptyString.is(''), 'fails Custom check');
});

test('Union', function(t){
    t.plan(3);

    var NonEmptyString = blazon(blazon.Union(String, blazon.Custom(x => assert(x, 'Must not be empty'))));

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

    t.throws(function(){
        StringOrNumber(false);
    }, 'Fails string check');
});

test('instanceof check', function(t){
    t.plan(1);

    var spec = blazon({
        something: String
    });

    var thing = spec({
        something: 'foo'
    });

    t.ok(thing instanceof spec);
});

test('Sub Spec', function(t){
    t.plan(4);

    var subSpec = blazon({
        something: String
    });

    var spec = blazon({
        sub: subSpec
    });

    var thing = spec({
        sub: {
            something: 'foo'
        }
    });

    t.pass('didnt throw');
    t.ok(thing instanceof spec, 'Right instance');
    t.ok(thing.sub instanceof subSpec, 'Right sub instance');

    try{
        spec({
            sub: {
                something: false
            }
        });
    } catch (error) {
        t.equal(error.message, 'Invalid type: Expected String, Got: false', 'Threw in subSpec');
    }
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

test('magic', function(t){
    t.plan(1);

    var add = blazon.magic({ a: String, b: String }, Number, () => {
        return a + b;
    })

    t.equal(add(2, 2, true), 4, 'Works for valid data');
});

test('magic no return type', function(t){
    t.plan(1);

    var add = blazon.magic({ a: String, b: String }, _=> {
        return a + b;
    });

    t.equal(add(2, 2, true), 4, 'Works for valid data');
});

test('magic maybe', function(t){
    t.plan(2);

    var add = blazon.magic({ a: String, b: String, c: blazon.Maybe(Boolean) }, Number, _=> {
        return c ? a + b : 0;
    });

    t.equal(add(2, 2, true), 4, 'Works for valid data');
    t.equal(add(2, 2), 0, 'Works for valid omitted data');
});

test('magic bad return', function(t){
    t.plan(1);

    var add = blazon.magic({ a: String, b: String, c: blazon.Maybe(Boolean) }, Number, _=> {
        return false;
    });

    t.throws(function(){
        add(2, 2, true);
    }, 'Throws for bad result');
});