<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    /** A guest opening a page of the church site, whatever host or account the test used before. */
    protected function visitor(string $path): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->get('http://localhost'.$path);
    }
}
