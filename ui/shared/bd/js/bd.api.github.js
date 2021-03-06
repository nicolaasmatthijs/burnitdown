/*
 * Copyright 2014 Digital Services (DS) Licensed under the
 * Educational Community License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 *     http://opensource.org/licenses/ECL-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an "AS IS"
 * BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

define(['exports', 'jquery'], function(exports, $) {

    var getEventsForRepositories = exports.getEventsForRepositories = function(repositories, callback) {
        var currentRepository = 0;
        var events = [];

        var getNextRepository = function() {
            var repository = repositories[currentRepository];
            getEventsForRepository(repository.split('/')[0], repository.split('/')[1], function(err, repositoryEvents) {
                if (err) {
                    return callback(err);
                }

                // Add the repository events to the overall list of events
                events = events.concat(repositoryEvents);

                currentRepository++;
                if (currentRepository === repositories.length) {
                    // Sort all events chronologically
                    events.sort(sortEvents);
                    return callback(null, events);
                } else {
                    getNextRepository();
                }
            });
        };

        getNextRepository();
    };

    var getEventsForRepository = exports.getEventsForRepository = function(user, project, callback) {
        // Get the issue comment request events
        getIssueCommentEventsForRepository(user, project, function(err, issueCommentEvents) {
            if (err) {
                return callback(err);
            }

            // Get the pull request comment events
            getPullCommentEventsForRepository(user, project, function(err, pullCommentEvents) {
                if (err) {
                    return callback(err);
                }

                // Get the issue events
                getIssueEventsForRepository(user, project, function(err, issueEvents) {
                    if (err) {
                        return callback(err);
                    }

                    // Merge and sort them chronologically
                    var events = issueCommentEvents.concat(pullCommentEvents);
                    events = events.concat(issueEvents);
                    events.sort(sortEvents);
                    return callback(null, events);
                });
            });
        });
    };

    var getIssueCommentEventsForRepository = exports.getIssueCommentEventsForRepository = function(user, project, callback) {
        $.ajax({
            'url': 'https://api.github.com/repos/' + user + '/' + project + '/issues/comments',
            'method': 'GET',
            'data': {
                'direction': 'desc',
                'sort': 'created'
            },
            'headers': {
                'Authorization': 'token ' + require('bd.core').data.token
            },
            'success': function(issueCommentEvents) {
                $.each(issueCommentEvents, function(issueCommentEventIndex, issueCommentEvent) {
                    issueCommentEvent.type = 'issue-comment-event';
                });
                callback(null, issueCommentEvents);
            }
        });
    };

    /**
     * [getPullCommentEventsForRepository description]
     *
     * @param  {[type]}   user     [description]
     * @param  {[type]}   project  [description]
     * @param  {Function} callback [description]
     *
     * @return {[type]}            [description]
     */
    var getPullCommentEventsForRepository = exports.getPullCommentEventsForRepository = function(user, project, callback) {
        $.ajax({
            'url': 'https://api.github.com/repos/' + user + '/' + project + '/pulls/comments',
            'method': 'GET',
            'data': {
                'direction': 'desc',
                'sort': 'created'
            },
            'headers': {
                'Authorization': 'token ' + require('bd.core').data.token
            },
            'success': function(pullCommentEvents) {
                $.each(pullCommentEvents, function(pullCommentEventIndex, pullCommentEvent) {
                    pullCommentEvent.type = 'pull-comment-event';
                });
                callback(null, pullCommentEvents);
            }
        });
    };

    /**
     * [getIssueEventsForRepository description]
     *
     * @param  {[type]}   user     [description]
     * @param  {[type]}   project  [description]
     * @param  {Function} callback [description]
     *
     * @return {[type]}            [description]
     */
    var getIssueEventsForRepository = exports.getIssueEventsForRepository = function(user, project, callback) {
        $.ajax({
            'url': 'https://api.github.com/repos/' + user + '/' + project + '/issues/events',
            'method': 'GET',
            'headers': {
                'Authorization': 'token ' + require('bd.core').data.token
            },
            'success': function(issueEvents) {
                // Filter out `subscribed` and `assigned` events, as they are covered
                // by the comments events
                issueEvents = _.filter(issueEvents, function(issueEvent) {
                    return (issueEvent.event !== 'subscribed' && issueEvent.event !== 'mentioned');
                });
                $.each(issueEvents, function(issueEventIndex, issueEvent) {
                    issueEvent.type = 'issue-event';
                });
                callback(null, issueEvents);
            }
        });
    };

    var sortEvents = function(eventA, eventB) {
        var eventATime = new Date(eventA['created_at']).getTime();
        var eventBTime = new Date(eventB['created_at']).getTime();
        if (eventATime < eventBTime) {
            return 1;
        } else if (eventATime > eventBTime) {
            return -1;
        } else {
            return 0;
        }
    };

    var getClosedIssuesForRepositories = exports.getClosedIssuesForRepositories = function(repositories, callback) {
        var currentRepository = 0;
        var closedIssues = [];

        var getNextRepository = function() {
            var repository = repositories[currentRepository];
            getClosedIssuesForRepository(repository.split('/')[0], repository.split('/')[1], function(err, closedIssuesForRepository) {
                if (err) {
                    return callback(err);
                }

                // Add the repository events to the overall list of events
                closedIssues = closedIssues.concat(closedIssuesForRepository);

                currentRepository++;
                if (currentRepository === repositories.length) {
                    return callback(null, closedIssues);
                } else {
                    getNextRepository();
                }
            });
        };

        getNextRepository();
    };

    /**
     * [getClosedIssuesForRepository description]
     *
     * @param  {[type]}   user     [description]
     * @param  {[type]}   project  [description]
     * @param  {Function} callback [description]
     *
     * @return {[type]}            [description]
     */
    var getClosedIssuesForRepository = exports.getClosedIssuesForRepository = function(user, project, callback) {
        var closedIssues = [];

        var getIssues = function(_page, _callback) {
            $.ajax({
                'url': 'https://api.github.com/repos/' + user + '/' + project + '/issues',
                'method': 'GET',
                'data': {
                    'page': _page,
                    'state': 'closed'
                },
                'headers': {
                    'Authorization': 'token ' + require('bd.core').data.token
                },
                'success': function(data) {
                    if (data.length) {
                        closedIssues = closedIssues.concat(data);
                        _page = _page + 1;
                        getIssues(_page, _callback);
                    } else {
                        _callback();
                    }
                },
                'error': function() {
                    _callback();
                }
            });
        };

        // Get the closed issues
        getIssues(1, function() {
            callback(null, closedIssues);
        });
    };

    var getOpenIssuesForRepositories = exports.getOpenIssuesForRepositories = function(repositories, callback) {
        var currentRepository = 0;
        var openIssues = [];

        var getNextRepository = function() {
            var repository = repositories[currentRepository];
            getOpenIssuesForRepository(repository.split('/')[0], repository.split('/')[1], function(err, openIssuesForRepository) {
                if (err) {
                    return callback(err);
                }

                // Add the repository events to the overall list of events
                openIssues = openIssues.concat(openIssuesForRepository);

                currentRepository++;
                if (currentRepository === repositories.length) {
                    return callback(null, openIssues);
                } else {
                    getNextRepository();
                }
            });
        };

        getNextRepository();
    };

    /**
     * [getOpenIssuesForRepository description]
     *
     * @param  {[type]}   user     [description]
     * @param  {[type]}   project  [description]
     * @param  {Function} callback [description]
     *
     * @return {[type]}            [description]
     */
    var getOpenIssuesForRepository = exports.getOpenIssuesForRepository = function(user, project, callback) {
        var openIssues = [];

        var getIssues = function(_page, _callback) {
            $.ajax({
                'url': 'https://api.github.com/repos/' + user + '/' + project + '/issues',
                'method': 'GET',
                'data': {
                    'page': _page,
                    'state': 'open'
                },
                'headers': {
                    'Authorization': 'token ' + require('bd.core').data.token
                },
                'success': function(data) {
                    if (data.length) {
                        openIssues = openIssues.concat(data);
                        _page = _page + 1;
                        getIssues(_page, _callback);
                    } else {
                        _callback(openIssues);
                    }
                },
                'error': function() {
                    _callback();
                }
            });
        };

        // Get the closed issues
        getIssues(1, function() {
            callback(null, openIssues);
        });
    };
});
