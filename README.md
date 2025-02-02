# Storm ⚡ <img src="docs/stormlogo.png" alt="alt text" width="100" style="vertical-align: middle;">

CMSI 3802: Languages and Automata II

## Introduction

Storm is a high-level, object oriented programming language brought to you by Jack Seymour, Lydia Worku, Gavin Butts, Jacquelyn Young-Bowers, and Maria Dominguez. This language was created for young children who are learning how to code. This easy-to-learn language is also helpful for any beginning programmers, as it contains consistent and readable code.

## Features

Storm is statically types, requiring the users to declare any variables, functions, or classes. To declare a new instance of *anything*, simply state `set...` (similar to `var` in other languages). We require the user to state the ending of loops, functions, or classes. In addition, instead of a "for loop", we refer to them as "laps". Lastly, to avoid the complexity of input streams in low high-level langaues, simply use "ask" to substitute.

## Examples of Programs

Five example programs can be found the the examples folder, including:  
> `ask-example.storm`
> `lap-example.storm`
> `program-example.storm`
> `recursion-example.storm`
> `object-example.storm`


For instance, `program-example.storm` looks like:
```
 # program (function) example - pizza counter
set program countSlices(people)
    set slicesEach to 2
    set totalSlicesNeeded to people * slicesEach
    say "You need " + totalSlicesNeeded + " slices of pizza for " + people + " people!"
end program

countSlices(10)   # Call the function for 10 people
countSlices(20)   # Call the function for 20 people
```
