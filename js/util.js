/**
    I allow myself to add some methods to built’in object prototypes
    since I do not load any external library that may interfere with it.

    DO NOT USE THIS FILE WHILE USING EXTERNAL JS LIBRARY.
*/

// extra methods in Set object
Object.defineProperty(Set.prototype, 'isSuperset', {
    value: function(subset) {
        for (let elem of subset) {
            if (!this.has(elem))
                return false;
        }
        return true;
    }
});

Object.defineProperty(Set.prototype, 'addAll', {
    value: function(other) {
        for (let elem of other) {
            this.add(elem);
        }
    }
});

Object.defineProperty(Set.prototype, 'union', {
    value: function(other) {
        let ret = new Set(this);
        ret.addAll(other);
        return ret;
    }
});

Object.defineProperty(Set.prototype, 'intersection', {
    value: function(other) {
        let ret = new Set();
        for (let elem of other) {
            if (this.has(elem))
                ret.add(elem);
        }
        return ret;
    }
});

Object.defineProperty(Set.prototype, 'symmetricDifference', {
    value: function(other) {
        let _difference = new Set(setA);
        for (let elem of setB) {
            if (_difference.has(elem)) {
                _difference.delete(elem);
            } else {
                _difference.add(elem);
            }
        }
        return _difference;
    }
});

Object.defineProperty(Set.prototype, 'difference', {
    value: function(other) {
        let _difference = new Set(setA);
        for (let elem of setB) {
            _difference.delete(elem);
        }
        return _difference;
    }
});


// ability to replace a part of a string (create a new string instance)
Object.defineProperty(String.prototype, 'replaceAt', {
    value: function(index, replacement) {
        if (this.length < index + replacement.length)
            return this.substring(0, index) + replacement;
        else
            return this.substring(0, index) + replacement + this.substring(index + replacement.length);
    }
});
