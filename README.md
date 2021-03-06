# blazon

A small, fast, non-trivial, dependency-free, non-stick, fully-franked, run-time type checker with an idiomatic API.

`HERALDRY`
> Describe or depict (armorial bearings) in a correct heraldic manner.

# Example:

## Creating Types:

```js
var blazon = require('blazon');
var { Maybe, Custom } = blazon;

const Email = blazon(blazon.And(
    String,
    Custom(value =>
        value.match(/^.+@[^.].*?\..*[^.]$/) ? value : throw new Error('Value must be an email')
    )
));

const User = blazon({
    firstName: String,
    surname: String,
    email: Maybe(Email),
    nickname: Maybe(String, 'Buddy'),
    age: Number
});

function greetUser(maybeNotAValidUser){
    // Throws if invalid.

    var user = User(maybeNotAValidUser);

    // user is valid at this point.
}

```

# Friggin' fast

On an i7 laptop:

100,000 non-trivial Types can be defined in ~700ms

100,000 non-trivial passing checks can be performed in ~130ms

10,000 non-trivial failing checks can be performed in ~37ms

# Available base types (BaseType):

value type constructors are valid, eg:

`String`, `Number`, `Boolean`

Extra types provided by blazon:

## `List(Type[, minLength, maxLength)`

Ensure every item in array matches Type, and optionally, that the length is between a min and max.

## `Maybe(Type, default<optional>)`

Ensure a value is either Type or null/undefined.

## `And(Types...)`

Ensures a value is every one of `Types`.

## `Or(Types...)`

Ensures a value is any one of `Types`.

## `Exactly(value)`

Ensures a value is exactly `value`

## `Cast(BaseType)` OR `Cast(sourceType, targetType, fn customConverer(value, target))`

Casts a value to a BaseType OR Casts from anything to anything with a customConverter.

## `Custom(fn<value, target, trace>)`

Ensures `fn(value)` does not throw.

The value returned from `fn` will be the result of the type instantiation.

# `ensure(types..., function)`

Create a function which only accepts specifically typed arguments.
