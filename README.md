# blazon

A small, fast, non-trivial, dependancy-free, non-stick, fully-franked, run-time type checker with an idiomatic API

`HERALDRY`
describe or depict (armorial bearings) in a correct heraldic manner.

# Example:

## Creating Types:
```
var blazon = require('blazen');
var { Maybe, Custom } = blazon;

const Email = blazon(blazon.Union(
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

    user instanceof User === true;
}

```

# Frigin-fast

1000,000 non-trivial Types can be defined on an i7 laptop in ~700ms
100,000 non-trivial passing checks can be performed on an i7 laptop in ~130ms
10,000 non-trivial failing checks can be performed on an i7 laptop in ~37ms

# Available base types:

value type constructors are valid, eg:

`String`, `Number`, `Boolean`

Extra types provided by blazon:

## `Maybe(Type, default<optional>)`

Ensure a value is either Type or null/undefined

## `Union(Types...)`

Ensures a value is every one of `Types`.

## `Or(Types...)`

Ensures a value is any one of `Types`.

## `Custom(fn<value>)`

Ensures `fn(value)` does not throw.

The value returned from `fn` will be the result of the type instansiation.

# `ensure(types..., function)`

Create a function which only accepts specifically typed arguments

# `magic(argumentTypeSignature, resultType, task)`

Dragons.

## Example:

```
var myFunction = blazon.magic({ firstName: String, surname: String }, String, _=> {
    return firstName + ' ' + surname;
})
```

throws if either the arguments or the return value are the wrong types.

Arguments exist automagicaly.