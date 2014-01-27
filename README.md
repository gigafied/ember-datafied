###ember-datafied
-----------------

Easy to use and customize data layer for Ember.js


##### Example

````js

App.RESTAdapter = DF.RESTAdapter.extend({
    host : '/',
    prefix : 'api/2.0/'
});

App.Model = DF.Model.extend({
    primaryKey : 'id',
    adapter : App.RESTAdapter.create()
});

App.User = App.Model.extend({
    name : DF.attr(),
    email : DF.attr()
});

App.Comment = App.Model.extend({
    title : DF.attr(),
    body : DF.attr(),
    user : DF.belongsTo('user', {key : 'userId', embedded : true})
});

App.Post = App.Model.extend({

    name : DF.attr(),
    body : DF.attr(),
    comments : DF.hasMany('comment', {key : 'commentIds'})
});

App.PostsRoute = Ember.Route.extend({

    model : function () {
        return this.store.fetchAll('post');
    }

});

````

#### Models

##### Methods:

- create()
- save()
- fetch()
- deleteRecord()
- clone()
- revert()
- merge()
- validate()
- serialize()
- deserialize()

##### Properties:

- pk
- isValid
- isNew
- isLoaded
- isLoading
- isDirty
- isClean

#### Adapters

##### Methods:

- find()
- all()
- saveRecord()
- fetch()
- fetchAll()
- createRecord()
- updateRecord()
- deleteRecord()


#### Store

##### Methods:

- all()
- find()
- fetch()
- fetchAll()
- fetchUnloadedRecords()
- findInCacheOrCreate()
- modelFor()
- add()
- remove()
- inject()

####building

    $ npm install
    $ node build.js


